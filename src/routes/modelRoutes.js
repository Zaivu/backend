const express = require('express');
const mongoose = require('mongoose');
const FlowModel = mongoose.model('FlowModel');
const Edge = mongoose.model('Edge');
const Node = mongoose.model('Node');
const requireAuth = require('../middlewares/requireAuth');
const { DateTime } = require('luxon');
const exceptions = require('../exceptions');
const router = express.Router();

router.use(requireAuth);

// ? fetchFlows (pagination)
router.get('/:tenantId/:page', async (req, res) => {
  const { tenantId, page } = req.params;
  const { title = '', alpha = false, creation = false } = req.query;

  const isAlpha = alpha === 'true';
  const isCreation = creation === 'true';

  const SortedBy = isCreation
    ? { createdAt: 1 }
    : isAlpha
    ? { title: 1 }
    : { createdAt: -1 };

  try {
    if (!page || !tenantId) {
      throw exceptions.unprocessableEntity();
    }

    const paginateOptions = {
      page,
      limit: 4,
      sort: SortedBy, // ultimas instancias
    };

    const Pagination = await FlowModel.paginate(
      { type: 'main', tenantId, title: { $regex: title, $options: 'i' } },
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
    res.status(err.code).send({ error: err.message });
  }
});

// ? FetchSingleFlow
router.get('/flow/:tenantId/:flowId', async (req, res) => {
  const { tenantId, flowId } = req.params;

  try {
    if (!tenantId | !flowId) {
      throw exceptions.unprocessableEntity();
    }

    const flow = await FlowModel.findById(flowId);

    if (!flow) {
      throw exceptions.entityNotFound();
    }

    const nodes = await Node.find({ flowId });
    const edges = await Edge.find({ flowId });

    const versions = await FlowModel.find({
      parentId: flowId,
      tenantId,
    });

    const versionModels = await Promise.all(
      versions.map(async (it) => {
        const newNodes = await Node.find({ flowId: it._id });
        const newEdges = await Edge.find({ flowId: it._id });

        const versionFlow = {
          title: it.title,
          _id: it._id,
          createdAt: it.createdAt,
          tenantId,
          type: it.type,
          elements: [...newNodes, ...newEdges],
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
        elements: [...nodes, ...edges],
        default: flow.default,
        lastUpdate: flow.lastUpdate,
      },

      versions: versionModels,
    };

    res.send({ flow: newFlow });
  } catch (err) {
    res.status(err.code).send({ error: err.message });
  }
});
// ? SearchFlow
router.get('/search/:tenantId/:page/:title', async (req, res) => {
  const { tenantId, page, title } = req.params;

  try {
    if (!title | !page | !tenantId) {
      throw exceptions.unprocessableEntity();
    }

    const number_of_pages = Math.ceil(
      (await FlowModel.count({
        tenantId,
        title: {
          $regex: title === 'undefined' ? RegExp('.*') : title,
          $options: 'i',
        },
      })) / 5
    );

    const flows = await FlowModel.find({
      tenantId,
      title: {
        $regex: title === 'undefined' ? RegExp('.*') : title,
        $options: 'i',
      },
    })
      .skip(5 * (page - 1))
      .limit(5);

    const idArray = flows.map((item) => item._id);
    const nodes = await Node.find({ flowId: { $in: idArray } });
    const edges = await Edge.find({ flowId: { $in: idArray } });

    const originalFlows = flows.filter(
      (item) => item.versionNumber === undefined
    );

    const formatedFlows = originalFlows.map((item) => {
      const newNodes = nodes.filter(
        (el) => el.flowId.toString() === item._id.toString()
      );
      const newEdges = edges.filter(
        (el) => el.flowId.toString() === item._id.toString()
      );

      const versionFlows = flows.filter(
        (el) => el?.originalId?.toString() === item._id.toString()
      );

      const formatedVersionFlows = versionFlows.map((it) => {
        const newNodes = nodes.filter(
          (el) => el.flowId.toString() === it._id.toString()
        );
        const newEdges = edges.filter(
          (el) => el.flowId.toString() === it._id.toString()
        );

        const versionFlow = {
          title: it.title,
          _id: it._id,
          createdAt: it.createdAt,
          tenantId,
          elements: [...newNodes, ...newEdges],
          position: it.position,
          originalId: it.originalId,
          versionNumber: it.versionNumber,
        };

        return versionFlow;
      });

      const flow = {
        title: item.title,
        _id: item._id,
        createdAt: item.createdAt,
        tenantId,
        elements: [...newNodes, ...newEdges],
        versions: formatedVersionFlows,
        defaultVersion: item.defaultVersion ? item.defaultVersion : 'default',
      };

      return flow;
    });

    res.send({ flows: formatedFlows, pages: number_of_pages });
  } catch (err) {
    res.status(err.code).send({ error: err.message });
  }
});

// ? Novo Fluxo
router.post('/new', async (req, res) => {
  try {
    const elements = req.body.elements;
    const { type, title, tenantId } = req.body.flow;

    if (!title | !type | !tenantId | !elements) {
      throw exceptions.unprocessableEntity();
    }
    const nowLocal = DateTime.now();

    // const alreadyExists = await FlowModel.find({ title, tenantId });
    // if (alreadyExists.length > 0) {
    //   throw exceptions.alreadyExists();
    // }

    let baseModel = {
      title,
      tenantId,
      createdAt: nowLocal,
      lastUpdate: nowLocal,
    };
    let flowModel;

    if (type === 'main') {
      flowModel = new FlowModel({ ...baseModel, default: null });
    } else if (type === 'version') {
      const { parentId } = req.body.flow;
      flowModel = new FlowModel({ ...baseModel, type, parentId });
    } else {
      throw exceptions.unprocessableEntity(
        'type argument must be: main or version'
      );
    }

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
    res.status(err.code).send({ error: err.message });
  }
});
// ? Copiar Fluxo
router.post('/copy', async (req, res) => {
  try {
    const { flowId, title } = req.body;

    if (!title | !flowId) {
      throw exceptions.unprocessableEntity();
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
    res.status(err.code).send({ error: err.message });
  }
});
// ? Renomeia um fluxo qualquer
router.put('/rename', async (req, res) => {
  const { title, flowId, parentId } = req.body;

  try {
    if (!title | !flowId | !parentId) {
      throw exceptions.unprocessableEntity();
    }

    //Para puxar todas as versoes preciso do parentID
    //Para puxar todos os fluxos preciso do flowId

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
    res.status(err.code).send({ message: err.message, code: err.code });
  }
});

// ? Edição de Fluxo
router.put('/edit', async (req, res) => {
  const { title, elements, flowId } = req.body;
  try {
    const nowLocal = DateTime.now();

    if (!title | !elements | !flowId) {
      throw exceptions.unprocessableEntity();
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
    res.status(err.code).send({ error: err.message });
  }
});

// ? Seta como padrão
router.put('/default', async (req, res) => {
  const { flowId, versionId } = req.body;

  try {
    const nowLocal = DateTime.now();

    if (!flowId | !versionId) {
      throw exceptions.unprocessableEntity();
    }

    const flowModel = await FlowModel.findByIdAndUpdate(
      flowId,
      { default: versionId ? versionId : null },
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
    res.status(err.code).send({ error: err.message });
  }
});

// ? Deleta o Projeto raiz e suas versões (se existirem)
router.delete('/project/:flowId', async (req, res) => {
  const { flowId } = req.params;
  let message;

  try {
    if (!flowId) {
      throw exceptions.unprocessableEntity();
    }

    const current = await FlowModel.findOne({ _id: flowId });

    if (!current) {
      throw exceptions.entityNotFound();
    }

    const allVersions = await FlowModel.find({ parentId: flowId });
    if (allVersions) {
      allVersions.forEach(async (item) => {
        await Node.remove({ flowId: item._id });
        await Edge.remove({ flowId: item._id });
        await FlowModel.findOneAndRemove({ _id: item._id });
      });
    }
    await Node.remove({ flowId });
    await Edge.remove({ flowId });
    await FlowModel.findOneAndRemove({ _id: flowId });
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
    res.status(err.code).send({ error: err.message });
  }
});
// ? Deleta 1 fluxo
router.delete('/flow/:flowId', async (req, res) => {
  const { flowId } = req.params;
  let message;

  try {
    if (!flowId) {
      throw exceptions.unprocessableEntity('flowId');
    }
    const current = await FlowModel.findOne({ _id: flowId });

    if (!current) {
      throw exceptions.entityNotFound();
    }

    await Node.remove({ flowId });
    await Edge.remove({ flowId });
    await FlowModel.findOneAndRemove({ _id: flowId });
    message = `Id: ${flowId} - Versão deletada com sucesso.`;

    res.status(200).send({
      flow: {
        title: current.title,
        type: current.type,
        message,
        flowId,
      },
    });
  } catch (err) {
    res.status(err.code).send({ error: err.message });
  }
});

module.exports = router;
