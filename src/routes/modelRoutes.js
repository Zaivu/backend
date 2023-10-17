const express = require("express");
const mongoose = require("mongoose");
const ObjectID = require("mongodb").ObjectID;
const FlowModel = mongoose.model("FlowModel");
const Edge = mongoose.model("Edge");
const Node = mongoose.model("Node");
const requireAuth = require("../middlewares/requireAuth");
const { DateTime } = require("luxon");
const exceptions = require("../exceptions");
const router = express.Router();
const checkPermission = require("../middlewares/userPermission");
const { removeAllVersionsPerma, removeModelPerma } = require("../utils/removeModels");

router.use(requireAuth, checkPermission);

const sortByMark = (a, b) => {
  if (a.type === "customMark" && b.type !== "customMark") {
    return -1; // "mark" comes before other types
  } else if (a.type !== "customMark" && b.type === "customMark") {
    return 1; // other types come after "mark"
  } else {
    return 0; // maintain the existing order
  }
};

// ? fetchFlows (pagination)
router.get("/pagination/:tenantId/:page", async (req, res) => {
  const { page = "1" } = req.params;
  const { title = "", alpha = false, creation = false } = req.query;

  const isAlpha = alpha === "true"; //Ordem do alfabeto
  const isCreation = creation === "true"; //Ordem de Criação
  const user = req.user;
  const tenantId = user.tenantId ? user.tenantId : user._id; //Caso admin ou tenantID

  const SortedBy = isCreation
    ? { createdAt: 1 }
    : isAlpha
      ? { title: 1 }
      : { createdAt: -1 };

  try {
    // console.log(req.query, { page }, { SortedBy }, { isAlpha, isCreation });

    const paginateOptions = {
      page,
      limit: 4,
      sort: SortedBy, // ultimas instancias
    };

    const Pagination = await FlowModel.paginate(
      {
        type: "main",
        tenantId,
        title: { $regex: title, $options: "i" },
        isDeleted: false,
      },
      paginateOptions
    );

    const flows = Pagination.docs;
    const totalPages = Pagination.totalPages;

    const newFlows = await Promise.all(
      flows.map(async (item) => {
        if (item.default) {
          const flow = await FlowModel.findById(item.default);

          return { ...item, versionTitle: flow.title };
        }
        return item;
      })
    );

    const modelFlows = newFlows.map(
      (item) => (item = { ...item._doc, versionTitle: item.versionTitle })
    );

    res.send({ flows: modelFlows, pages: totalPages });
  } catch (err) {
    const code = err.code ? err.code : "412";

    res.status(code).send({ error: err.message, code });
  }
});

// ? ListAll
router.get("/list/", async (req, res) => {
  // const { tenantId } = req.params;
  const user = req.user;
  const tenantId = user.tenantId ? user.tenantId : user._id;

  try {
    if (!ObjectID.isValid(tenantId)) {
      throw exceptions.unprocessableEntity("tenantId must be a valid ObjectId");
    }

    const projects = await FlowModel.find({
      isDeleted: false,
      tenantId,
    });

    const projectType = projects.filter((item) => item.type === "main");
    const versionType = projects.filter((item) => item.type === "version");

    const allFlowsProject = projectType.map((item) => {
      const allVersions = versionType.filter((version) => {
        const id = item._id.toString();
        const parentId = version.parentId.toString();
        if (parentId === id) {
          return version;
        }
      });

      return {
        main: {
          _id: item._id,
          title: item.title,
          createdAt: item.createdAt,
        },
        versions: allVersions.map(
          (v) => (v = { _id: v._id, title: v.title, createdAt: v.createdAt })
        ),
        default: item.default,
      };
    });

    res.status(200).send({ projects: allFlowsProject });
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

// ? FetchSingleFlow
router.get("/flow/:flowId", async (req, res) => {
  const { flowId } = req.params;
  const user = req.user;
  const tenantId = user.tenantId ? user.tenantId : user._id;

  try {
    if (!ObjectID.isValid(flowId)) {
      throw exceptions.unprocessableEntity(
        "flowId | tenantId must be a valid ObjectID"
      );
    }

    const flow = await FlowModel.findOne({ _id: flowId, tenantId });

    if (!flow) {
      throw exceptions.entityNotFound();
    }

    const nodes = await Node.find({ flowId });
    const edges = await Edge.find({ flowId });

    const sortedNodes = nodes.sort(sortByMark);

    const versions = await FlowModel.find({
      parentId: flowId,
      tenantId,
    });

    const versionModels = await Promise.all(
      versions.map(async (it) => {
        const newNodes = await Node.find({
          flowId: it._id,
        });

        const newSortedNodes = newNodes.sort(sortByMark);
        const newEdges = await Edge.find({ flowId: it._id });

        const versionFlow = {
          title: it.title,
          _id: it._id,
          createdAt: it.createdAt,
          tenantId,
          type: it.type,
          elements: [...newSortedNodes, ...newEdges],
          parentId: it.parentId,
          lastUpdate: it.lastUpdate,
        };

        return versionFlow;
      })
    );

    const newFlow = {
      main: {
        title: flow.title,
        _id: flow._id,
        createdAt: flow.createdAt,
        tenantId,
        type: flow.type,
        elements: [...sortedNodes, ...edges],
        default: flow.default,
        lastUpdate: flow.lastUpdate,
      },

      versions: versionModels,
    };

    res.status(200).send({ flow: newFlow });
  } catch (err) {
    // console.log(err);
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

// ? Novo Projeto
router.post("/new", async (req, res) => {
  try {
    const elements = req.body.elements;
    const { type, title } = req.body.flow;
    const isArray = Array.isArray;

    const user = req.user;
    const tenantId = user.tenantId ? user.tenantId : user._id;

    //req.body, req.params, req.user, req.query

    if (!(typeof title === "string") || !isArray(elements)) {
      throw exceptions.unprocessableEntity("Invalid argumnt type");
    }
    if (type !== "main") {
      throw exceptions.unprocessableEntity("type argument must be: main");
    }

    const nowLocal = DateTime.now();

    let baseModel = {
      title,
      tenantId,
      createdAt: nowLocal,
      lastUpdate: nowLocal,
    };

    const flowModel = new FlowModel({ ...baseModel, default: null });

    const flow = await flowModel.save();

    await Promise.all(
      elements.map(async (item) => {
        if (item.source) {
          const edge = new Edge({
            tenantId,
            flowId: flowModel._id,
            id: item.id,
            type: item.type,
            position: item.position,
            data: item.data,
            source: item.source,
            target: item.target,
            sourceHandle: item.sourceHandle,
            targetHandle: item.targetHandle,
          });
          await edge.save();
        } else {
          const node = new Node({
            flowId: flowModel._id,
            tenantId,
            id: item.id,
            type: item.type,
            position: item.position,
            data: item.data,
            targetPosition: item.targetPosition,
            sourcePosition: item.sourcePosition,
          });
          await node.save();
        }
      })
    );

    const edges = await Edge.find({ flowId: flow._id });
    const nodes = await Node.find({ flowId: flow._id });

    res.status(200).json({
      flow: {
        title: flow.title,
        _id: flow._id,
        createdAt: flow.createdAt,
        tenantId: flow.tenantId,
        type: flow.type,
        elements: [...nodes, ...edges],
      },
    });
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

// ? Novo Fluxo (Versionamento)
router.post("/new/model", async (req, res) => {
  try {
    const elements = req.body.elements;
    const { type, title, parentId } = req.body.flow;
    const isArray = Array.isArray;

    const user = req.user;
    const tenantId = user.tenantId ? user.tenantId : user._id;

    if (
      !(typeof title === "string") ||
      !isArray(elements) ||
      !ObjectID.isValid(parentId)
    ) {
      throw exceptions.unprocessableEntity("Invalid argument type");
    }

    if (type !== "version") {
      throw exceptions.unprocessableEntity("type argument must be: version");
    }

    const nowLocal = DateTime.now();

    let baseModel = {
      title,
      tenantId,
      createdAt: nowLocal,
      lastUpdate: nowLocal,
    };
    let flowModel;

    const alreadyExists = await FlowModel.find({
      $or: [
        { _id: parentId, title },
        { parentId, title },
      ],
    });

    if (alreadyExists.length > 0) {
      throw exceptions.alreadyExists();
    }

    flowModel = new FlowModel({ ...baseModel, type, parentId });

    const flow = await flowModel.save();
    // se houver _id em um elemento crasha
    await Promise.all(
      elements.map(async (item) => {
        if (item.source) {
          const edge = new Edge({
            tenantId,
            flowId: flowModel._id,
            id: item.id,
            type: item.type,
            position: item.position,
            data: item.data,
            source: item.source,
            target: item.target,
            sourceHandle: item.sourceHandle,
            targetHandle: item.targetHandle,
          });
          await edge.save();
        } else {
          const node = new Node({
            tenantId,
            flowId: flowModel._id,
            id: item.id,
            type: item.type,
            position: item.position,
            data: item.data,
            targetPosition: item.targetPosition,
            sourcePosition: item.sourcePosition,
          });
          await node.save();
        }
      })
    );

    const edges = await Edge.find({ flowId: flow._id });
    const nodes = await Node.find({ flowId: flow._id });

    res.status(200).json({
      flow: {
        title: flow.title,
        _id: flow._id,
        createdAt: flow.createdAt,
        tenantId: flow.tenantId,
        type: flow.type,
        elements: [...nodes, ...edges],
      },
    });
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

// ? Copiar Projeto
router.post("/copy", async (req, res) => {
  try {
    const { flowId, title } = req.body;

    if (!(typeof title === "string") || !ObjectID.isValid(flowId)) {
      throw exceptions.unprocessableEntity("Invalid argument type");
    }

    //Puxar a data do fluxo a ser copiado
    const nowLocal = DateTime.now();
    const flow = await FlowModel.findById(flowId);

    //Fluxo não encontrado
    if (!flow) {
      throw exceptions.entityNotFound();
    }

    const nodes = await Node.find({ flowId });
    const edges = await Edge.find({ flowId });

    //Modelo Base
    const baseModel = {
      title: title,
      tenantId: flow.tenantId,
      type: flow.type,
      createdAt: nowLocal,
      lastUpdate: nowLocal,
      default: null,
    };

    //Novo Default
    let baseDefault = flow.default;
    let baseTitle = null;

    //Fluxo Principal
    const model = new FlowModel({ ...baseModel });
    const modelFlow = await model.save();

    const elements = [...nodes, ...edges];

    //Elementos do Fluxo Principal
    await Promise.all(
      elements.map(async (item) => {
        if (item.source) {
          const edge = new Edge({
            flowId: modelFlow._id,
            tenantId: modelFlow.tenantId,
            id: item.id,
            type: item.type,
            position: item.position,
            data: item.data,
            source: item.source,
            target: item.target,
            sourceHandle: item.sourceHandle,
            targetHandle: item.targetHandle,
          });
          await edge.save();
        } else {
          const node = new Node({
            flowId: modelFlow._id,
            tenantId: modelFlow.tenantId,
            id: item.id,
            type: item.type,
            position: item.position,
            data: item.data,
            targetPosition: item.targetPosition,
            sourcePosition: item.sourcePosition,
          });
          await node.save();
        }
      })
    );
    //Puxar todas as versões originais
    const allVersions = await FlowModel.find({
      parentId: flow._id,
      tenantId: flow.tenantId,
    });

    if (allVersions.length > 0) {
      //Percorrer cada uma das versões e copiar todos os Elementos

      for (const [, version] of allVersions.entries()) {
        const baseVersion = {
          parentId: modelFlow._id,
          title: version.title,
          tenantId: version.tenantId,
          type: version.type,
          createdAt: nowLocal,
          lastUpdate: nowLocal,
        };
        baseTitle = flow._id === version.parentId ? version.title : null;

        //Salvando Versão
        const vModel = new FlowModel({ ...baseVersion });

        const versionFlow = await vModel.save();

        const vNodes = await Node.find({ flowId: version._id });
        const vEdges = await Edge.find({ flowId: version._id });

        const vElements = [...vNodes, ...vEdges];

        //Salvando Elementos da Versão[i]
        await Promise.all(
          vElements.map(async (item) => {
            if (item.source) {
              const edge = new Edge({
                flowId: versionFlow._id,
                tenantId: versionFlow.tenantId,
                id: item.id,
                type: item.type,
                position: item.position,
                data: item.data,
                source: item.source,
                target: item.target,
                sourceHandle: item.sourceHandle,
                targetHandle: item.targetHandle,
              });
              await edge.save();
            } else {
              const node = new Node({
                flowId: versionFlow._id,
                tenantId: versionFlow.tenantId,
                id: item.id,
                type: item.type,
                position: item.position,
                data: item.data,
                targetPosition: item.targetPosition,
                sourcePosition: item.sourcePosition,
              });
              await node.save();
            }
          })
        );
      }
    }

    if (baseDefault) {
      //Para achar a versão correta é necessario
      //titulo da versão original + parentId do fluxo cópia
      const currentVersion = await FlowModel.findOne({
        baseTitle,
        parentId: modelFlow._id,
      });

      await FlowModel.findOneAndUpdate(
        { _id: modelFlow._id },
        { default: currentVersion._id },
        { useFindAndModify: false }
      );
    }

    res.status(200).json({
      flow: {
        title: modelFlow.title,
        _id: modelFlow._id,
        createdAt: modelFlow.createdAt,
        tenantId: modelFlow.tenantId,
        type: modelFlow.type,
      },
    });
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});
// ? Renomeia um fluxo qualquer
router.put("/rename", async (req, res) => {
  const { title, flowId, parentId } = req.body;

  try {
    if (
      !(typeof title === "string") ||
      !ObjectID.isValid(flowId) ||
      !ObjectID.isValid(parentId)
    ) {
      throw exceptions.unprocessableEntity("Invalid argument type");
    }

    //Para puxar todas as versoes precisa do parentID
    //Para puxar todos os fluxos precisa do flowId

    const isAlreadyExist = await FlowModel.find({
      $or: [
        { _id: flowId, title },
        { _id: parentId, title },
        { parentId, title },
      ],
    });

    if (isAlreadyExist.length > 0) {
      throw exceptions.alreadyExists();
    }
    const nowLocal = DateTime.now();
    const flow = await FlowModel.findOneAndUpdate(
      { _id: flowId },
      { title, lastUpdate: nowLocal },
      { new: true, useFindAndModify: false }
    );

    res.status(200).json({
      flow: {
        _id: flow._id,
        title: flow.title,
        type: flow.type,
        lastUpdate: nowLocal,
      },
    });
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

// ? Edição de Fluxo
router.put("/edit", async (req, res) => {
  const { title, elements, flowId } = req.body;
  const isArray = Array.isArray;
  try {
    const nowLocal = DateTime.now();

    if (
      !(typeof title === "string") ||
      !isArray(elements) ||
      !ObjectID.isValid(flowId)
    ) {
      throw exceptions.unprocessableEntity("Invalid argument type");
    }

    const alreadyExists = await FlowModel.find({
      $or: [
        { parentId: flowId, title }, //Versões
      ],
    });

    if (alreadyExists.length > 0) {
      throw exceptions.alreadyExists();
    }

    const flow = await FlowModel.findOneAndUpdate(
      { _id: flowId },
      { title: title, lastUpdate: nowLocal },
      { new: true, useFindAndModify: false }
    );

    if (!flow) {
      throw exceptions.entityNotFound();
    }

    await Node.remove({ flowId });
    await Edge.remove({ flowId });

    await Promise.all(
      elements.map(async (item) => {
        if (item.source) {
          const edge = new Edge({ ...item, flowId });
          await edge.save();
        } else {
          const node = new Node({ ...item, flowId });
          await node.save();
        }
      })
    );

    const nodes = await Node.find({ flowId: flow._id });
    const edges = await Edge.find({ flowId: flow._id });

    res.status(200).json({
      flow: {
        title: flow.title,
        _id: flow._id,
        createdAt: flow.createdAt,
        tenantId: flow.tenantId,
        type: flow.type,
        parentId: flow.parentId,
        elements: [...nodes, ...edges],
        lastUpdate: flow.lastUpdate,
      },
    });
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

// ? Seta como padrão
router.put("/default", async (req, res) => {
  const { flowId, versionId } = req.body;

  try {
    const nowLocal = DateTime.now();

    if (!ObjectID.isValid(flowId)) {
      throw exceptions.unprocessableEntity("flowId must be a valid ObjectID");
    }

    const flowModel = await FlowModel.findByIdAndUpdate(
      flowId,
      { default: versionId },
      { new: true, useFindAndModify: false }
    );

    res.status(200).json({
      flow: {
        flowId: flowModel._id,
        default: flowModel.default,
        lastUpdate: nowLocal,
      },
    });
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

// ? Deleta o Projeto raiz e suas versões via tag (se existirem)
router.put("/project/:flowId", async (req, res) => {
  const { flowId } = req.params;
  let message;

  try {
    if (!ObjectID.isValid(flowId)) {
      throw exceptions.unprocessableEntity("flowId must be a valid objectID");
    }

    const current = await FlowModel.findOne({ _id: flowId });

    if (!current) {
      throw exceptions.entityNotFound();
    }

    const allVersions = await FlowModel.find({ parentId: flowId });
    if (allVersions) {
      allVersions.forEach(async (item) => {
        await Node.updateMany(
          { flowId: item._id },
          { $set: { isDeleted: true } },
          { new: true }
        );
        await Edge.updateMany(
          { flowId: item._id },
          { $set: { isDeleted: true } },
          { new: true }
        );
        await FlowModel.findByIdAndUpdate(
          { _id: item.id },
          {
            isDeleted: true,
          }
        );
      });
    }
    await Node.updateMany(
      { _id: flowId },
      { $set: { isDeleted: true } },
      { new: true }
    );
    await Edge.updateMany(
      { _id: flowId },
      { $set: { isDeleted: true } },
      { new: true }
    );
    await FlowModel.findByIdAndUpdate(
      { _id: flowId },
      {
        isDeleted: true,
      }
    );
    message = `Id: ${flowId} - Projeto deletado com sucesso.`;

    res.status(200).send({
      flow: {
        title: current.title,
        type: current.type,
        message,
        flowId,
      },
    });
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

// ? Deleta o Projeto raiz e suas versões permanentemente (se existirem)
router.delete("/project/permanently/:flowId", async (req, res) => {
  const { flowId } = req.params;
  const user = req.user;
  const tenantId = user.tenantId ? user.tenantId : user._id; //Caso admin ou tenantID

  try {
    if (!ObjectID.isValid(flowId)) {
      throw exceptions.unprocessableEntity("flowId must be a valid objectID");
    }

    const current = await FlowModel.findOne({ _id: flowId, tenantId, type: 'main' });

    if (!current) {
      throw exceptions.entityNotFound();
    }

    await removeAllVersionsPerma(current._id, { FlowModel, Node, Edge });
    await removeModelPerma(current._id, { FlowModel, Node, Edge })

    res.status(200).send({
      current,
    });
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});


// ? Deleta 1 fluxo permanentemente
router.delete("/flow/:flowId", async (req, res) => {
  const { flowId } = req.params;

  try {
    if (!ObjectID.isValid(flowId)) {
      throw exceptions.unprocessableEntity("flowId must be a valid object ID");
    }
    const current = await FlowModel.findOne({ _id: flowId });

    if (!current) {
      throw exceptions.entityNotFound();
    }
    await removeModelPerma(current._id, { FlowModel, Node, Edge })
    // await Node.remove({ flowId });
    // await Edge.remove({ flowId });
    // await FlowModel.findOneAndRemove({ _id: flowId }); 


    res.status(200).send({
      flow: {
        title: current.title,
        type: current.type,
        flowId,
      },
    });
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});




module.exports = router;
