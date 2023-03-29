const express = require('express');
const moment = require('moment');
const mongoose = require('mongoose');
const ObjectID = require('mongodb').ObjectID;
const exceptions = require('../exceptions');
const requireAuth = require('../middlewares/requireAuth');

const router = express.Router();
const { DateTime } = require('luxon');
const { randomUUID } = require('crypto');

const ActivedFlow = mongoose.model('ActivedFlow');
const ActivedEdge = mongoose.model('ActivedEdge');
const ActivedNode = mongoose.model('ActivedNode');
const ChatMessage = mongoose.model('ChatMessage');
const multerConfig = require('../config/multer');
const multer = require('multer');

const Node = mongoose.model('Node');
const Edge = mongoose.model('Edge');
// const FlowModel = mongoose.model('FlowModel');

const Post = mongoose.model('Post');

router.use(requireAuth);

let newStatus = [];

function walkParallelLoop(nodes, edges, item, callback) {
  ////SE FOR ARESTA
  if (item.source) {
    return nodes.map((el) => {
      if (el.id === item.target) {
        if (el.type === 'parallel') {
          walkParallelLoop(nodes, edges, el, callback);
        }
        callback(el);
      }
    });
  }
  ////SE FOR NÓ
  else {
    return edges.map((element) => {
      if (element.source === item.id) {
        walkParallelLoop(nodes, edges, element, callback);
        callback(element);
      }
    });
  }
}
function walkEndLoop(nodes, edges, item, callback) {
  ////SE FOR ARESTA
  if (item.source) {
    return nodes.map((el) => {
      if (el.id === item.target) {
        if (el.type === 'parallelEnd') {
          let validation = true;

          edges.map((edge) => {
            if (edge.target === el.id) {
              nodes.map((node) => {
                if (node.id === edge.source) {
                  if (node.data.status !== 'done') {
                    validation = false;
                    newStatus.push(node.id);
                  }
                }
              });
            }
          });

          if (validation) {
            newStatus = [];
            el.data.status = 'done';
            walkEndLoop(nodes, edges, el, callback);
            callback(el);
          }
        } else if (el.type === 'conditionalEnd') {
          el.data.status = 'done';
          walkEndLoop(nodes, edges, el, callback);
          callback(el);
        } else {
          const nowLocal = moment().utcOffset(-180);
          ///TAREFA OU CONDICIONAL
          if (
            el.type === 'task' ||
            el.type === 'conditional' ||
            el.type === 'timerEvent'
          ) {
            if (el.type === 'timerEvent') {
              ///ativa o timer
            }

            el.data.status = 'doing';
            el.data.startedAt = nowLocal;
            newStatus.push(el.id);
          }
          ////EVENTO DE FIM
          else if (el.type === 'eventEnd') {
            el.data.status = 'done';
            newStatus = ['finished'];
          }
          ///PARALELO
          else if (el.type === 'parallel') {
            el.data.status = 'done';
            walkParallelLoop(nodes, edges, el, (node) => {
              if (node.source) {
                node.data.status = 'done';
              }
              if (node.type === 'task') {
                node.data.startedAt = nowLocal;
                node.data.status = 'doing';
                newStatus.push(node.id);
              }
              if (node.type === 'conditional') {
                node.data.startedAt = nowLocal;
                node.data.status = 'doing';
                newStatus.push(node.id);
              }
              if (node.type === 'parallel') {
                node.data.status = 'done';
              }
            });
          }
        }
      }
    });
  }
  ////SE FOR NÓ
  else {
    return edges.map((element) => {
      if (element.source === item.id) {
        walkEndLoop(nodes, edges, element, callback);
        callback(element);
      }
    });
  }
}

//Pagination
router.get(
  '/pagination/:tenantId/:page',

  async (req, res) => {
    const { page = '1' } = req.params;
    const { title = '' } = req.query;
    const { _id: tenantId } = req.user;

    // const isAlpha = alpha === 'true'; //Ordem do alfabeto
    // const isCreation = creation === 'true'; //Ordem de Criação

    const SortedBy = { createdAt: -1 };

    try {
      if (!ObjectID.isValid(tenantId)) {
        throw exceptions.unprocessableEntity(
          'tenantId must be a valid ObjectId'
        );
      }

      const paginateOptions = {
        page,
        limit: 4,
        sort: SortedBy, // ultimas instancias
      };

      const Pagination = await ActivedFlow.paginate(
        { tenantId, title: { $regex: title, $options: 'i' } },
        paginateOptions
      );

      const flows = Pagination.docs;
      const totalPages = Pagination.totalPages;

      res.send({ activedflows: flows, pages: totalPages });
    } catch (err) {
      const code = err.code ? err.code : '412';
      res.status(code).send({ error: err.message, code });
    }
  }
);

//Single Flow
router.get('/flow/:tenantId/:flowId', async (req, res) => {
  const { flowId } = req.params;
  const { _id: tenantId } = req.user;
  try {
    if (!ObjectID.isValid(tenantId) || !ObjectID.isValid(flowId)) {
      throw exceptions.unprocessableEntity(
        'tenantId | flowId must be a valid ObjectId'
      );
    }

    const flow = await ActivedFlow.findOne({ _id: flowId });

    const nodes = await ActivedNode.find({ flowId: flow._id });
    const edges = await ActivedEdge.find({ flowId: flow._id });

    let newNodes = nodes.filter(
      (el) => el.flowId.toString() === flow._id.toString()
    );
    const newNodesWithPosts = await Promise.all(
      newNodes.map(async (item) => {
        if (item.type === 'task') {
          let newItem = JSON.parse(JSON.stringify(item));
          newItem.data.attachLength = await Post.count({
            originalId: item._id,
          });
          return newItem;
        } else {
          return item;
        }
      })
    );
    const newEdges = edges.filter(
      (el) => el.flowId.toString() === flow._id.toString()
    );

    const newFlow = {
      tenantId,
      _id: flow._id,
      title: flow.title,
      status: flow.status,
      createdAt: flow.createdAt,
      finishedAt: flow.finishedAt,
      description: flow.description,
      comments: flow.comments,
      posts: flow.posts,
      client: flow.client,
      lastState: flow.lastState,
      elements: [...newNodesWithPosts, ...newEdges],
    };
    res.send({ flow: newFlow });
  } catch (err) {
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});

//Add Active Flow
router.post('/new', async (req, res) => {
  try {
    const { flowId, title, client = '', description } = req.body;
    const { _id: tenantId } = req.user;
    // const isArray = Array.isArray;

    //Elementos serão puxados diretamente da requisição

    if (
      !(typeof title === 'string') ||
      !ObjectID.isValid(tenantId) ||
      !(typeof description === 'string') ||
      !(typeof client === 'string')
    ) {
      throw exceptions.unprocessableEntity('Invalid argument types');
    }
    const nodes = await Node.find({ flowId });
    const edges = await Edge.find({ flowId });

    ////////////////////

    const start = nodes.find((e) => e.type === 'eventStart'); //node
    const arrow = edges.find((e) => e.source === start.id); //edge
    const afterStart = nodes.find((e) => arrow.target === e.id); //node
    const doing = [afterStart.id]; //node
    const doingEdges = [arrow.id]; //edge

    const elements = [...nodes, ...edges];

    if (afterStart.type === 'parallel') {
      doing.pop();

      elements.map((e) => {
        if (e._id === afterStart._id) e.data.status = 'done';
      });

      walkParallelLoop(nodes, edges, afterStart, (node) => {
        if (node.source) {
          doingEdges.push(node.id);
        } else if (
          node.type === 'task' ||
          node.type === 'conditional' ||
          node.type === 'timerEvent'
        ) {
          doing.push(node.id);
        } else if (node.type === 'parallel') {
          node.data.status = 'done';
        }
      });
    }

    /////////////////////

    const nowLocal = DateTime.now();

    let baseModel = {
      title,
      tenantId,
      description,
      client,
      createdAt: nowLocal,
      lastUpdate: nowLocal,
    };

    const liveModel = new ActivedFlow({ ...baseModel, default: null });

    const activedFlow = await liveModel.save();

    await Promise.all(
      elements.map(async (item) => {
        if (item.source) {
          const test = !!doingEdges.find((e) => e === item.id);

          const edge = new ActivedEdge({
            source: item.source,
            target: item.target,
            sourceHandle: item.sourceHandle,
            targetHandle: item.targetHandle,
            id: item.id,
            type: item.type,
            data:
              item.data === undefined
                ? { ...item.data, status: 'pending' }
                : {
                    ...item.data,
                    status: test ? 'done' : 'pending',
                  },
            flowId: activedFlow._id,
            tenantId,
          });
          await edge.save();
        } else {
          let subtasks = [];

          if (item.type === 'task') {
            item.data.subtasks.map((e) => {
              subtasks.push({ title: e, checked: false });
            });
          }

          const node = new ActivedNode({
            type: item.type,
            id: item.id,
            position: item.position,
            data:
              item.type === 'task'
                ? {
                    ...item.data,
                    comments: '',
                    posts: [],
                    status: doing.find((e) => e === item.id)
                      ? 'doing'
                      : 'pending',
                    subtasks,
                    accountable: 'Ninguém',
                    startedAt: doing.find((e) => e === item.id)
                      ? nowLocal
                      : undefined,
                  }
                : item.type === 'timerEvent'
                ? {
                    ...item.data,
                    status: doing.find((e) => e === item.id)
                      ? 'doing'
                      : 'pending',
                    startedAt: doing.find((e) => e === item.id)
                      ? nowLocal
                      : undefined,
                  }
                : {
                    ...item.data,
                    status:
                      item.type === 'eventStart'
                        ? 'done'
                        : doing.find((e) => e === item.id)
                        ? 'doing'
                        : item.data.status !== 'model'
                        ? item.data.status
                        : 'pending',
                  },
            flowId: activedFlow._id,
            targetPosition: item.targetPosition,
            sourcePosition: item.sourcePosition,
            tenantId,
          });
          await node.save();
        }
      })
    );

    const acNodes = await ActivedNode.find({ flowId: activedFlow._id });
    const acEdges = await ActivedEdge.find({ flowId: activedFlow._id });

    res.status(200).json({
      activedflow: {
        title: activedFlow.title,
        _id: activedFlow._id,
        client: activedFlow.client,
        status: activedFlow.status,
        createdAt: activedFlow.createdAt,
        finishedAt: activedFlow.finishedAt,
        tenantId: activedFlow.tenantId,
        comments: activedFlow.comments,
        posts: activedFlow.posts,
        lastState: activedFlow.lastState,
        elements: [...acNodes, ...acEdges],
      },
    });
  } catch (err) {
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});

//Confirm task | conditional option
router.put('/node/confirm', async (req, res) => {
  const { flowId, taskId, edgeId } = req.body;

  //EdgeId

  const nowLocal = DateTime.now();

  try {
    //////////////ATUAL

    const taskExpired = await ActivedNode.findOne({ _id: taskId });

    // const subtasks = taskExpired.data.subtasks.map((item) => {
    //   return { ...item, checked: true };s
    // });

    const nodes = await ActivedNode.find({ flowId });
    const edges = await ActivedEdge.find({ flowId });

    await ActivedFlow.findByIdAndUpdate(flowId, {
      lastState: [...nodes, ...edges],
    });

    let taskUpdated;

    if (taskExpired.type === 'task') {
      taskUpdated = await ActivedNode.findOneAndUpdate(
        { _id: taskId },
        {
          $set: {
            'data.status': 'done',
            'data.finishedAt': nowLocal,
            'data.expired':
              moment(taskExpired.data.startedAt)
                .add(taskExpired.data.expiration.number, 'hours')
                .diff(nowLocal, 'hours', true) < 0
                ? true
                : false,
            // 'data.subtasks': subtasks,
          },
        }
      );
    } else {
      taskUpdated = await ActivedNode.findOneAndUpdate(
        { _id: taskId },
        {
          $set: {
            'data.status': 'done',
            'data.finishedAt': nowLocal,
          },
        }
      );
    }

    let arrowUpdated;

    const nextEdge = await ActivedEdge.findOne({
      flowId,
      _id: edgeId,
    });

    if (taskUpdated.type === 'task') {
      arrowUpdated = await ActivedEdge.findOneAndUpdate(
        { source: taskUpdated.id, flowId },
        { $set: { 'data.status': 'done' } }
      );
    } else {
      arrowUpdated = await ActivedEdge.findOneAndUpdate(
        { _id: nextEdge._id },
        { $set: { 'data.status': 'done' } }
      );
    }

    ////////PROXIMO
    const nextTask = await ActivedNode.findOne({
      id: arrowUpdated.target,
      flowId,
    });

    //////////Tarefa ou condicional
    if (
      nextTask.type === 'task' ||
      nextTask.type === 'conditional' ||
      nextTask.type === 'timerEvent'
    ) {
      const nodes = await ActivedNode.find({ flowId });

      await ActivedNode.findOneAndUpdate(
        { _id: nextTask._id },
        { $set: { 'data.status': 'doing', 'data.startedAt': nowLocal } }
      );

      if (newStatus[0] !== 'finished') {
        let filter = nodes.filter(
          (item) =>
            item.data.status === 'doing' &&
            (item.type === 'task' ||
              item.type === 'conditional' ||
              item.type === 'timerEvent')
        );
        newStatus = filter.map((item) => item.id);
        if (
          nextTask.type === 'task' ||
          nextTask.type === 'conditional' ||
          nextTask.type === 'timerEvent'
        )
          newStatus.push(nextTask.id);
      }
    } else if (nextTask.type === 'parallel') {
      const edges = await ActivedEdge.find({ flowId });
      const nodes = await ActivedNode.find({ flowId });

      nodes.map((item) =>
        item.id === nextTask.id ? (item.data.status = 'done') : null
      );

      walkParallelLoop(nodes, edges, nextTask, (node) => {
        if (node.source) {
          node.data.status = 'done';
        }
        if (node.type === 'task') {
          node.data.startedAt = nowLocal;
          node.data.status = 'doing';
        }
        if (node.type === 'timerEvent') {
          node.data.startedAt = nowLocal;
          node.data.status = 'doing';
        }
        if (node.type === 'conditional') {
          node.data.startedAt = nowLocal;
          node.data.status = 'doing';
        }
        if (node.type === 'parallel') {
          node.data.status = 'done';
        }
      });

      await Promise.all(
        nodes.map(async (item) => {
          await ActivedNode.findOneAndUpdate({ _id: item._id }, item);
        })
      );

      await Promise.all(
        edges.map(async (item) => {
          await ActivedEdge.findOneAndUpdate({ _id: item._id }, item);
        })
      );

      if (newStatus[0] !== 'finished') {
        let filter = nodes.filter(
          (item) =>
            item.data.status === 'doing' &&
            (item.type === 'task' ||
              item.type === 'conditional' ||
              item.type === 'timerEvent')
        );
        newStatus = filter.map((item) => item.id);
        if (
          nextTask.type === 'task' ||
          nextTask.type === 'conditional' ||
          nextTask.type === 'timerEvent'
        )
          newStatus.push(nextTask.id);
      }
    } else if (
      nextTask.type === 'parallelEnd' ||
      nextTask.type === 'conditionalEnd'
    ) {
      const edges = await ActivedEdge.find({ flowId });
      const nodes = await ActivedNode.find({ flowId });

      walkEndLoop(
        nodes,
        edges,
        edges.find((e) => e.target === nextTask.id),
        (node) => {
          if (node.type === 'conditionalEnd' || node.type === 'parallelEnd') {
            node.data.status = 'done';
          }
          if (node.source) {
            node.data.status = 'done';
          }
        }
      );

      await Promise.all(
        nodes.map(async (item) => {
          await ActivedNode.findOneAndUpdate({ _id: item._id }, item);
        })
      );

      await Promise.all(
        edges.map(async (item) => {
          await ActivedEdge.findOneAndUpdate({ _id: item._id }, item);
        })
      );

      if (newStatus[0] !== 'finished') {
        let filter = nodes.filter(
          (item) =>
            item.data.status === 'doing' &&
            (item.type === 'task' ||
              item.type === 'conditional' ||
              item.type === 'timerEvent')
        );
        newStatus = filter.map((item) => item.id);
        if (
          nextTask.type === 'task' ||
          nextTask.type === 'conditional' ||
          nextTask.type === 'timerEvent'
        )
          newStatus.push(nextTask.id);
      }
    } else if (nextTask.type === 'eventEnd') {
      newStatus = ['finished'];

      await ActivedNode.findOneAndUpdate(
        { _id: nextTask._id },
        { $set: { 'data.status': 'done' } }
      );
    }

    if (newStatus[0] === 'finished') {
      await ActivedFlow.findOneAndUpdate(
        { _id: flowId },
        { status: newStatus, finishedAt: nowLocal }
      );
    } else {
      await ActivedFlow.findOneAndUpdate(
        { _id: flowId },
        { status: newStatus }
      );
    }

    const activedFlow = await ActivedFlow.findById(flowId);
    const newNodes = await ActivedNode.find({ flowId: flowId });
    const newEdges = await ActivedEdge.find({ flowId: flowId });

    newStatus = [];

    const flow = {
      _id: activedFlow._id,
      title: activedFlow.title,
      status: activedFlow.status,
      createdAt: activedFlow.createdAt,
      finishedAt: activedFlow.finishedAt,
      comments: activedFlow.comments,
      posts: activedFlow.posts,
      tenantId: activedFlow.tenantId,
      client: activedFlow.client,
      lastState: activedFlow.lastState,
      elements: [...newNodes, ...newEdges],
    };

    res.status(200).json({
      flow,
    });
  } catch (err) {
    console.log(err);

    res.status(422).send({ error: err.message });
  }
});

//undo lastState
router.put('/undo', async (req, res) => {
  const { flowId } = req.body;

  try {
    const flow = await ActivedFlow.findById(flowId);

    await Promise.all(
      flow.lastState.map(async (item) => {
        if (item.source) {
          await ActivedEdge.findByIdAndUpdate(item._id, { ...item });
        } else {
          await ActivedNode.findByIdAndUpdate(item._id, { ...item });
        }
      })
    );

    const newFlow = await ActivedFlow.findByIdAndUpdate(
      flowId,
      { lastState: [] },
      { new: true }
    );
    const nodes = await ActivedNode.find({ flowId });
    const edges = await ActivedEdge.find({ flowId });

    res.send({
      flow: {
        _id: newFlow._id,
        title: newFlow.title,
        status: newFlow.status,
        createdAt: newFlow.createdAt,
        finishedAt: newFlow.finishedAt,
        comments: newFlow.comments,
        posts: newFlow.posts,
        tenantId: newFlow.tenantId,
        client: newFlow.client,
        lastState: newFlow.lastState,
        elements: [...nodes, ...edges],
      },
    });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

//add Subtask
router.post('/task/subtask/new', async (req, res) => {
  try {
    const { taskId, title = 'Subtarefa', checked = false } = req.body;

    // const currentTask = await ActivedNode.findById({ _id: taskId });
    // const allSubtasks = currentTask.data.subtasks;

    const randomId = randomUUID();

    const taskUpdated = await ActivedNode.findOneAndUpdate(
      { _id: taskId },
      {
        $push: {
          'data.subtasks': {
            title: title + ' ' + DateTime.now(),
            checked,
            id: randomId,
          },
        },
      },
      { new: true }
    );

    const subtasks = taskUpdated.data.subtasks;

    res.send({ subtasks, taskId: taskUpdated._id });
  } catch (err) {
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});

//update Subtask
router.put('/task/subtask/update', async (req, res) => {
  try {
    const { taskId, id, title = '', checked = false } = req.body;

    const currentTask = await ActivedNode.findById({ _id: taskId });

    const allSubtasks = currentTask.data.subtasks;

    const updatingSubtasks = allSubtasks.map((item) =>
      item.id === id ? (item = { ...item, title, checked }) : item
    );

    const taskUpdated = await ActivedNode.findOneAndUpdate(
      { _id: taskId },
      {
        $set: { 'data.subtasks': updatingSubtasks },
      },
      {
        new: true,
      }
    );

    const subtasks = taskUpdated.data.subtasks;

    res.send({ subtasks, taskId: taskUpdated._id });
  } catch (err) {
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});

//removeSubtask
router.delete('/task/subtask/delete/:taskId/:id', async (req, res) => {
  try {
    const { taskId, id } = req.params;

    const currentTask = await ActivedNode.findById({ _id: taskId });

    const allSubtasks = currentTask.data.subtasks;

    const updatingSubtasks = allSubtasks.filter((item) => item.id !== id);

    const taskUpdated = await ActivedNode.findOneAndUpdate(
      { _id: taskId },
      {
        $set: { 'data.subtasks': updatingSubtasks },
      },
      {
        new: true,
      }
    );
    const subtasks = taskUpdated.data.subtasks;

    res.send({ subtasks, taskId: taskUpdated._id });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

//update Subtask
router.put('/task/description', async (req, res) => {
  try {
    const { taskId, description = '' } = req.body;

    const taskUpdated = await ActivedNode.findOneAndUpdate(
      { _id: taskId },
      {
        $set: { 'data.comments': description },
      },
      {
        new: true,
      }
    );

    const newDescription = taskUpdated.data.comments;

    res.send({ description: newDescription, taskId: taskUpdated._id });
  } catch (err) {
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});

//Chat Message
//Get all log messages from id
router.get('/chat/list/:refId', async (req, res) => {
  try {
    const { refId } = req.params;

    const chatLog = await ChatMessage.find({ refId }).sort({ createdAt: -1 });

    res.send({ chatLog });
  } catch (err) {
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});

//Send Message
router.post('/chat/new', async (req, res) => {
  try {
    const { userId, refId, username, message, type } = req.body;

    const baseModel = {
      userId,
      refId,
      username,
      message,
      type,
    };

    const model = new ChatMessage({
      ...baseModel,
      createdAt: DateTime.now(),
    });

    const chatMessage = await model.save();

    res.send({ chatMessage });
  } catch (err) {
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});

//Files

//get Files
router.get('/files/:originalId', async (req, res) => {
  const { originalId } = req.params;
  const posts = await Post.find({ originalId });
  res.send(posts);
});

//new File
router.post(
  '/task/new-file',
  multer(multerConfig).single('file'),
  async (req, res) => {
    const { originalname: name, size, key, location: url = '' } = req.file;
    const { originalId, type, tenantId } = req.body;

    const post = await Post.create({
      name,
      size,
      key,
      url,
      originalId,
      type,
      tenantId,
    });

    return res.json(post);
  }
);

//Delete File
router.delete('/task/remove-file/:fileId', async (req, res) => {
  const { fileId } = req.params;
  const post = await Post.findById(fileId);

  await post.remove();

  res.send();
});

module.exports = router;
