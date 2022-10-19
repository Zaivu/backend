const express = require('express');
const mongoose = require('mongoose');
const FlowModel = mongoose.model('FlowModel');
const Edge = mongoose.model('Edge');
const Node = mongoose.model('Node');
const moment = require('moment');
const requireAuth = require('../middlewares/requireAuth');
const { DateTime } = require('luxon');
const router = express.Router();

router.use(requireAuth);

// ? Paginação
router.get('/flow-models/:tenantId/:page', async (req, res) => {
  const { tenantId, page } = req.params;

  try {
    const number_of_pages = Math.ceil(
      (await FlowModel.count({
        tenantId,
        versionNumber: null,
      })) / 4
    );

    const flows = await FlowModel.find({ tenantId, type: 'main' })
      .skip(4 * (page - 1))
      .limit(4);

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

    res.send({ flows: modelFlows, pages: number_of_pages });
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

// ? Renomeia um fluxo qualquer (projeto ou versão)
router.put('/flow-models/flow-model/rename', async (req, res, next) => {
  const { title, _id, versionTitle, originalId } = req.body;

  try {
    const nowLocal = moment().utcOffset(-180);
    let flow;

    //Caso seja uma versão
    if (versionTitle) {
      flow = await FlowModel.findOneAndUpdate(
        { _id },
        { versionNumber: versionTitle },
        { new: true, useFindAndModify: false }
      );
      await FlowModel.findOneAndUpdate(
        { _id: originalId },
        { lastUpdate: nowLocal },
        { new: true, useFindAndModify: false }
      );
    } else {
      //Caso seja o projeto
      flow = await FlowModel.findOneAndUpdate(
        { _id: originalId },
        { title: title, lastUpdate: nowLocal },
        { new: true, useFindAndModify: false }
      );
    }

    res.status(200).json({
      flowData: {
        _id: flow._id,
        title: flow.title,
        ...(flow.versionNumber && { versionNumber: flow.versionNumber }),
        lastUpdate: nowLocal,
        originalId: originalId,
      },
    });
  } catch (err) {
    next(err);
    res.status(422).send({ error: err.message });
  }
});

// ? Novo Fluxo
router.post('/flow-models/flow-model/new-flow', async (req, res) => {
  try {
    const elements = req.body.elements;
    const { type, title, tenantId } = req.body.flow;

    if (!elements && !flow) {
      throw new Error('undefined state to add new flow');
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
        elements: [...nodes, ...edges],
      },
    });
  } catch (err) {
    console.log(err);
    res.status(422).send({ error: err.message });
  }
});
// ? Edição de Fluxo
router.put('/flow-models/flow-model/edit', async (req, res) => {
  const { title, elements, _id } = req.body;
  try {
    const nowLocal = DateTime.now();

    if (!title | !elements | _id) {
      throw new Error(' undefined state to edit Flow');
    }

    const flow = await FlowModel.findOneAndUpdate(
      { _id },
      { title: title, lastUpdate: nowLocal },
      { new: true, useFindAndModify: false }
    );

    await Node.remove({ flowId: _id });
    await Edge.remove({ flowId: _id });

    await Promise.all(
      elements.map(async (item) => {
        if (item.source) {
          const edge = new Edge({ ...item, flowId: _id });
          await edge.save();
        } else {
          const node = new Node({ ...item, flowId: _id });
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

    await FlowModel.findByIdAndUpdate(
      flowId,
      { default: versionId },
      { new: true, useFindAndModify: false }
    );

    res.status(200).json({ versionId, flowId, lastUpdate: nowLocal });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});
// ? Deletar um Fluxo (versão)
router.delete(
  '/flow-models/flow-model/delete/version/:originalId/:flowId',
  async (req, res, next) => {
    const { flowId, originalId } = req.params;

    try {
      const nowLocal = moment().utcOffset(-180);

      const flow = await FlowModel.findOne({ _id: flowId });

      if (!flow) {
        throw new Error('Exception: undefined _id');
      }

      await FlowModel.findByIdAndUpdate(
        { _id: originalId },
        { lastUpdate: nowLocal },
        { new: true, useFindAndModify: false }
      );

      await FlowModel.findOneAndRemove({ _id: flowId });

      await Node.remove({ flowId });
      await Edge.remove({ flowId });

      res.send({
        message: `Id: ${flowId} deletado com sucesso.`,
        id: flowId,
        lastUpdate: nowLocal,
      });
    } catch (err) {
      next(err);
      res.status(422).send({ error: err });
    }
  }
);
// ? Deleta o Projeto raiz e suas versões (se existirem)
router.delete(
  '/flow-models/flow-model/delete/project/:flowId',
  async (req, res) => {
    const { flowId } = req.params;

    try {
      const allVersions = await FlowModel.find({ originalId: flowId });

      if (allVersions) {
        allVersions.forEach(async (item) => {
          await Node.remove({ flowId: item._id });
          await Edge.remove({ flowId: item._id });
          await FlowModel.findOneAndRemove({ _id: item._id });
        });
      }

      await FlowModel.findOneAndRemove({ _id: flowId });

      res.status(200).send({
        message: `Id: ${flowId} deletado com sucesso.`,
        allVersions: allVersions.length,
        flowId: flowId,
      });
    } catch (err) {
      res.status(422).send({ error: err.message });
    }
  }
);

// ? Edição de tarefa (flowViewer)
router.put('/flow-models/flow-model/task/edit', async (req, res) => {
  const { title, expiration, subtasks, taskId, version, attachFile, lockTask } =
    req.body;

  try {
    const newTask = await Node.findOneAndUpdate(
      { _id: taskId },
      {
        data: {
          label: title,
          expiration,
          subtasks,
          status: 'model',
          attachFile: attachFile,
          lockTask: lockTask,
        },
      },
      { new: true }
    );

    const flow = await FlowModel.findOne({ _id: newTask.flowId });

    if (version === 'default') {
      res.send({ newTask, version, flowId: newTask.flowId });
    } else {
      res.send({ newTask, version, flowId: flow.originalId });
    }
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});
// ? Edição de Temporizador (flowViewer)
router.put('/flow-models/flow-model/timer/edit', async (req, res) => {
  const { expiration, timerId, version } = req.body;

  try {
    const newTimer = await Node.findOneAndUpdate(
      { _id: timerId },
      { data: { label: 'Temporizador', expiration } },
      { new: true }
    );

    const flow = await FlowModel.findOne({ _id: newTimer.flowId });

    if (version === 'default') {
      res.send({ newTimer, version, flowId: newTimer.flowId });
    } else {
      res.send({ newTimer, version, flowId: flow.originalId });
    }
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

module.exports = router;
