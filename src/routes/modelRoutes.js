const express = require('express');
const mongoose = require('mongoose');
const FlowModel = mongoose.model('FlowModel');
const Edge = mongoose.model('Edge');
const Node = mongoose.model('Node');
const requireAuth = require('../middlewares/requireAuth');
const { DateTime } = require('luxon');
const router = express.Router();

router.use(requireAuth);

// ? fetchFlows (pagination)
router.get('/flow-models/:tenantId/:page', async (req, res) => {
  const { tenantId, page } = req.params;
  const { type = 'main', title = '' } = req.query;

  try {
    const paginateOptions = {
      page,
      // limit: 4,
      sort: { createdAt: -1 }, // ultimas instancias
    };

    const Pagination = await FlowModel.paginate(
      { type, tenantId, title: { $regex: title, $options: 'i' } },
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
    console.log(err);
    res.status(422).send({ error: err.message });
  }
});

// ? FetchSingleFlow
router.get('/flow-models/flow-single/:tenantId/:flowId', async (req, res) => {
  const { tenantId, flowId } = req.params;

  try {
    const flow = await FlowModel.findById(flowId);
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
    res.status(422).send({ error: err.message });
  }
});
// ? SearchFlow
router.get('/model-flows/search/:tenantId/:page/:title', async (req, res) => {
  const { tenantId, page, title } = req.params;

  try {
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
    res.status(422).send({ error: err.message });
  }
});

// ? Novo Fluxo
router.post('/flow-models/flow-model/new-flow', async (req, res) => {
  try {
    const elements = req.body.elements;
    const { type, title, tenantId } = req.body.flow;

    if (!elements && !flow) {
      throw new Error('undefined state: /new-flow');
    }

    const nowLocal = DateTime.now();
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
      throw new Error('Unknown flow type');
    }

    const flow = await flowModel.save();
    await Promise.all(
      elements.map(async (item) => {
        if (item.source) {
          const edge = new Edge({
            ...item,
            flowId: flowModel._id,
            tenantId,
          });
          await edge.save();
        } else {
          const node = new Node({
            ...item,
            flowId: flowModel._id,
            tenantId,
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
    console.log(err);
    res.status(422).send({ error: err.message });
  }
});

// ? Renomeia um fluxo qualquer
router.put('/flow-models/flow-model/rename', async (req, res, next) => {
  const { title, flowId } = req.body;

  try {
    const nowLocal = DateTime.now();

    if (!title | !flowId) {
      throw new Error('undefined state: /rename');
    }

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
    next(err);
    res.status(422).send({ error: err.message });
  }
});

// ? Edição de Fluxo
router.put('/flow-models/flow-model/edit', async (req, res) => {
  const { title, elements, flowId } = req.body;
  try {
    const nowLocal = DateTime.now();

    if (!title | !elements | !flowId) {
      throw new Error('undefined state: /edit');
    }

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
    res.status(422).send({ error: err.message });
  }
});

// ? Seta como padrão
router.put('/flow-models/flow-model/new-default-version', async (req, res) => {
  const { flowId, versionId } = req.body;

  try {
    const nowLocal = DateTime.now();

    if (!flowId) {
      throw new Error('undefined state: /new-default-version');
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
    res.status(422).send({ error: err.message });
  }
});

// ? Deleta o Projeto raiz e suas versões (se existirem)
router.delete('/project/:flowId', async (req, res) => {
  const { flowId } = req.params;
  let message;

  try {
    if (!flowId) {
      throw new Error('undefined flowId: /delete');
    }
    const current = await FlowModel.findOne({ _id: flowId });

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
        message,
        flowId,
        type: current.type,
      },
    });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});
// ? Deleta 1 fluxo
router.delete('/flow/:flowId', async (req, res) => {
  const { flowId } = req.params;
  let message;

  try {
    if (!flowId) {
      throw new Error('undefined flowId: /delete');
    }
    const current = await FlowModel.findOne({ _id: flowId });

    if (!current) {
      throw new Error('cannot find the flow entity');
    }

    await Node.remove({ flowId });
    await Edge.remove({ flowId });
    await FlowModel.findOneAndRemove({ _id: flowId });
    message = `Id: ${flowId} - Versão deletada com sucesso.`;

    res.status(200).send({
      flow: {
        message,
        flowId,
        type: current.type,
      },
    });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

module.exports = router;
