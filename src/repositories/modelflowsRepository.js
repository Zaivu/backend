// modelflowsRepository.js
const FlowModel = require("../models/FlowModel"); // Certifique-se de que o modelo do Mongoose est� definido
const Node = require("../models/Node");
const Edge = require("../models/Edge");
const exceptions = require("../exceptions");
const { DateTime } = require("luxon");
const {
  removeAllVersionsPerma,
  removeModelPerma,
  removeMainFlow,
} = require("../utils/removeModels");

// Realizar sort para casos de marcadores no fluxo
const sortByMark = (a, b) => {
  if (a.type === "customMark" && b.type !== "customMark") {
    return -1; // "mark" comes before other types
  } else if (a.type !== "customMark" && b.type === "customMark") {
    return 1; // other types come after "mark"
  } else {
    return 0; // maintain the existing order
  }
};

class ModelflowsRepository {
  async pagination(tenantId, page, query) {
    const { title = "", alpha = false, creation = false } = query;

    const isAlpha = alpha === "true"; //Ordem do alfabeto
    const isCreation = creation === "true"; //Ordem de Criação

    const SortedBy = isCreation
      ? { createdAt: 1 }
      : isAlpha
      ? { title: 1 }
      : { createdAt: -1 };

    const paginateOptions = {
      page,
      limit: 4,
      sort: { ...SortedBy, _id: 1 }, // ultimas instancias
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

    return { flows: modelFlows, pages: totalPages };
  }

  async list(tenantId) {
    const projects = await FlowModel.find({ isDeleted: false, tenantId });

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

    return allFlowsProject;
  }

  async getFlow(flowId, tenantId) {
    const flow = await FlowModel.findOne({ _id: flowId, tenantId });

    if (!flow) {
      throw exceptions.entityNotFound("Fluxo Modelo");
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

    return newFlow;
  }

  async findFlow(query) {
    return await FlowModel.findOne(query);
  }

  async new(baseModel, elements) {
    const flowModel = new FlowModel({ ...baseModel });

    const flow = await flowModel.save();

    await Promise.all(
      elements.map(async (item) => {
        if (item.source) {
          const edge = new Edge({
            tenantId: baseModel.tenantId,
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
            tenantId: baseModel.tenantId,
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

    return {
      flow: {
        title: flow.title,
        _id: flow._id,
        createdAt: flow.createdAt,
        tenantId: flow.tenantId,
        type: flow.type,
        elements: [...nodes, ...edges],
      },
    };
  }

  async copy(flow, title) {
    const nowLocal = DateTime.now();

    const flowId = flow._id;
    const baseModel = {
      title,
      tenantId: flow.tenantId,
      type: flow.type,
      createdAt: nowLocal,
      lastUpdate: nowLocal,
      default: null,
    };
    const nodes = await Node.find({ flowId });
    const edges = await Edge.find({ flowId });

    //Novo Default
    let baseTitle = null;
    let baseDefault = flow.default;

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

    return {
      flow: {
        title: modelFlow.title,
        _id: modelFlow._id,
        createdAt: modelFlow.createdAt,
        tenantId: modelFlow.tenantId,
        type: modelFlow.type,
      },
    };
  }

  async rename(flowId, title) {
    const nowLocal = DateTime.now();
    return await FlowModel.findOneAndUpdate(
      { _id: flowId },
      { title, lastUpdate: nowLocal },
      { new: true, useFindAndModify: false }
    );
  }

  async edit(flowId, title, elements) {
    const nowLocal = DateTime.now();

    const flow = await FlowModel.findOneAndUpdate(
      { _id: flowId },
      { title: title, lastUpdate: nowLocal },
      { new: true, useFindAndModify: false }
    );

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

    return {
      title: flow.title,
      _id: flow._id,
      createdAt: flow.createdAt,
      tenantId: flow.tenantId,
      type: flow.type,
      parentId: flow.parentId,
      elements: [...nodes, ...edges],
      lastUpdate: flow.lastUpdate,
    };
  }

  async setDefault(flowId, versionId) {
    return await FlowModel.findByIdAndUpdate(
      flowId,
      { default: versionId },
      { new: true, useFindAndModify: false }
    );
  }
  async deleteProject(flowId) {
    await removeAllVersionsPerma(flowId, { FlowModel, Node, Edge });
    await removeModelPerma(flowId, { FlowModel, Node, Edge });

    return flowId;
  }

  async deleteFlow(flow) {
    const schemas = { FlowModel, Node, Edge };
    let mainVersion = null;

    if (flow.type === "main") {
      mainVersion = await removeMainFlow(flow, schemas);
    } else {
      await removeModelPerma(flow._id, schemas);
    }

    return {
      flow: {
        title: flow.title,
        type: flow.type,
        flowId: flow._id,
        baseModel: mainVersion ? mainVersion : null,
      },
    };
  }
}

module.exports = ModelflowsRepository;
