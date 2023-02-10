const express = require('express');
const mongoose = require('mongoose');
const ObjectID = require('mongodb').ObjectID;
const exceptions = require('../exceptions');
const requireAuth = require('../middlewares/requireAuth');
const router = express.Router();
const { DateTime } = require('luxon');

const ActivedFlow = mongoose.model('ActivedFlow');
const ActivedEdge = mongoose.model('ActivedEdge');
const ActivedNode = mongoose.model('ActivedNode');

const Node = mongoose.model('Node');
const Edge = mongoose.model('Edge');
// const FlowModel = mongoose.model('FlowModel');

const Post = mongoose.model('Post');

router.use(requireAuth);

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

//Pagination
router.get('/pagination/:tenantId/:page', async (req, res) => {
  const { tenantId, page = '1' } = req.params;
  const { title = '' } = req.query;

  // const isAlpha = alpha === 'true'; //Ordem do alfabeto
  // const isCreation = creation === 'true'; //Ordem de Criação

  const SortedBy = { createdAt: -1 };

  try {
    if (!ObjectID.isValid(tenantId)) {
      throw exceptions.unprocessableEntity('tenantId must be a valid ObjectId');
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
});

//Single Flow
router.get('/flow/:tenantId/:flowId', async (req, res) => {
  const { tenantId, flowId } = req.params;

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
    const { flowId, title, tenantId, client = '', description } = req.body;
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
module.exports = router;
