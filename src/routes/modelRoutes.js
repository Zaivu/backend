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

    const flows = await FlowModel.find({ tenantId, versionNumber: null })
      .skip(4 * (page - 1))
      .limit(4);

    const originalFlows = flows.filter(
      (item) => item.versionNumber === undefined
    );

    const allFlowsVersions = await FlowModel.find({
      tenantId,
      versionNumber: { $exists: true },
    });

    const formatedFlows = originalFlows.map((item) => {
      const flow = {
        title: item.title,
        _id: item._id,
        createdAt: item.createdAt,
        tenantId,
        ...(item.lastUpdate && { lastUpdate: item.lastUpdate }),
        defaultVersion:
          item.defaultVersion !== 'default' ? item.defaultVersion : 'Original',
        defaultVersionName:
          item.defaultVersion !== 'default'
            ? allFlowsVersions.find(
                (it) =>
                  JSON.stringify(item.defaultVersion) === JSON.stringify(it._id)
              )?.versionNumber
            : 'default',
      };

      return flow;
    });

    res.send({ flows: formatedFlows, pages: number_of_pages });
  } catch (err) {
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

    const versionFlows = await FlowModel.find({
      originalId: flowId,
    });

    const formatedVersionFlows = await Promise.all(
      versionFlows?.map(async (it) => {
        const newNodes = await Node.find({ flowId: it._id });
        const newEdges = await Edge.find({ flowId: it._id });

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
      })
    );

    const newFlow = {
      title: flow.title,
      _id: flow._id,
      createdAt: flow.createdAt,
      tenantId,
      elements: [...nodes, ...edges],
      versions: formatedVersionFlows,
      defaultVersion: flow.defaultVersion ? flow.defaultVersion : 'default',
      ...(flow.lastUpdate && { lastUpdate: flow.lastUpdate }),
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
  const { title, elements, tenantId, type = 'main', parentId } = req.body;

  try {
    const nowLocal = DateTime.now();
    let baseModel = {
      title,
      elements,
      tenantId,
      createdAt: nowLocal,
      lastUpdate: nowLocal,
    };
    let flowModel;
    if (type === 'main') {
      flowModel = new FlowModel({ ...baseModel });
    } else if (type === 'version') {
      flowModel = new FlowModel({ ...baseModel, type, parentId });
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
    console.log(err.message);
    res.status(422).send({ error: err.message });
  }
});
// ? Adiciona nova versão
router.put('/flow-models/flow-model/new-version', async (req, res) => {
  const { title, elements, versionNumber, tenantId, _id } = req.body;

  try {
    const nowLocal = moment().utcOffset(-180);
    const allflows = await FlowModel.find({ originalId: _id });

    await FlowModel.findOneAndUpdate(
      { _id: _id },
      { lastUpdate: nowLocal },
      { new: true, useFindAndModify: false }
    );

    const flowModel = new FlowModel({
      title: title,
      createdAt: nowLocal,
      tenantId,
      originalId: _id,
      position: allflows?.length + 1,
      versionNumber: versionNumber,
    });

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
        originalId: flow.originalId,
        position: flow.position,
        versionNumber: versionNumber,
      },
      lastUpdate: nowLocal,
    });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

// ? Edição de Fluxo
router.put('/flow-models/flow-model/edit', async (req, res) => {
  const { title, elements, _id } = req.body;
  try {
    const nowLocal = DateTime.now();

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
        lastUpdate: flow.lastUpdate,
        elements: [...nodes, ...edges],
        versions: flow.versions ? flow.versions : [],
      },
    });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

// ? Seta como padrão
router.put('/flow-models/flow-model/new-default-version', async (req, res) => {
  const { flowId, defaultVersion } = req.body;

  try {
    const nowLocal = DateTime.now();

    await FlowModel.findByIdAndUpdate(
      flowId,
      { defaultVersion },
      { new: true, useFindAndModify: false }
    );

    res.status(200).json({ defaultVersion, flowId, lastUpdate: nowLocal });
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
      const nodes = await Node.remove({ flowId });
      const edges = await Edge.remove({ flowId });

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
      res.send({ newTimer, version, flowId: newTask.flowId });
    } else {
      res.send({ newTimer, version, flowId: flow.originalId });
    }
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

module.exports = router;
