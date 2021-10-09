const express = require("express");
const moment = require("moment");
const multer = require("multer");
const { promisify } = require("util");
const mongoose = require("mongoose");
const fs = require("fs");
const requireAuth = require("../middlewares/requireAuth");
const multerConfig = require("../config/multer");
const ActivedFlow = mongoose.model("ActivedFlow");
const ActivedEdge = mongoose.model("ActivedEdge");
const ActivedNode = mongoose.model("ActivedNode");
const Post = mongoose.model("Post");
const router = express.Router();

const storage = multer.diskStorage({
  destination: "./files",
  filename(req, file, cb) {
    cb(null, `${new Date()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

const RedisClustr = require("redis-clustr");
const redis = require("redis");
const util = require("util");
let client;
let get;
let set;
let del;

if (process.env.REDIS_CLUSTER === "true") {
  client = new RedisClustr({
    servers: [
      {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
      },
    ],
    createClient: function (port, host) {
      // this is the default behaviour
      return redis.createClient(port, host);
    },
  });

  get = util.promisify(client.get).bind(client);
  set = util.promisify(client.set).bind(client);
  del = util.promisify(client.del).bind(client);

  client.on("error", (err) => {
    console.log("DEU ERRO NO REDIS", err);
  });
}

router.use(requireAuth);

let newStatus = [];

function walkParallelLoop(nodes, edges, item, callback) {
  ////SE FOR ARESTA
  if (item.source) {
    return nodes.map((el) => {
      if (el.id === item.target) {
        if (el.type === "parallel") {
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
        if (el.type === "parallelEnd") {
          let validation = true;

          edges.map((edge) => {
            if (edge.target === el.id) {
              nodes.map((node) => {
                if (node.id === edge.source) {
                  if (node.data.status !== "done") {
                    validation = false;
                    newStatus.push(node.id);
                  }
                }
              });
            }
          });

          if (validation) {
            newStatus = [];
            el.data.status = "done";
            walkEndLoop(nodes, edges, el, callback);
            callback(el);
          }
        } else if (el.type === "conditionalEnd") {
          el.data.status = "done";
          walkEndLoop(nodes, edges, el, callback);
          callback(el);
        } else {
          const nowLocal = moment().utcOffset(-180);
          ///TAREFA OU CONDICIONAL
          if (
            el.type === "task" ||
            el.type === "conditional" ||
            el.type === "timerEvent"
          ) {
            if (el.type === "timerEvent") {
              ///ativa o timer
            }

            el.data.status = "doing";
            el.data.startedAt = nowLocal;
            newStatus.push(el.id);
          }
          ////EVENTO DE FIM
          else if (el.type === "eventEnd") {
            el.data.status = "done";
            newStatus = ["finished"];
          }
          ///PARALELO
          else if (el.type === "parallel") {
            el.data.status = "done";
            walkParallelLoop(nodes, edges, el, (node) => {
              if (node.source) {
                node.data.status = "done";
              }
              if (node.type === "task") {
                node.data.startedAt = nowLocal;
                node.data.status = "doing";
                newStatus.push(node.id);
              }
              if (node.type === "conditional") {
                node.data.startedAt = nowLocal;
                node.data.status = "doing";
                newStatus.push(node.id);
              }
              if (node.type === "parallel") {
                node.data.status = "done";
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

router.get("/posts", async (req, res) => {
  const posts = await Post.find();

  return res.json(posts);
});

router.post("/posts", multer(multerConfig).single("file"), async (req, res) => {
  const { originalname: name, size, key, location: url = "" } = req.file;

  const post = await Post.create({
    name,
    size,
    key,
    url,
  });

  return res.json(post);
});

router.delete("/posts/:id", async (req, res) => {
  const post = await Post.findById(req.params.id);

  await post.remove();

  return res.send();
});

router.get("/actived-flows/:enterpriseId", async (req, res) => {
  const { enterpriseId } = req.params;

  let result;

  if (process.env.REDIS_CLUSTER === "true")
    result = await get(`activedflows/${enterpriseId}`);

  if (!result) {
    try {
      const flows = await ActivedFlow.find({ enterpriseId });
      const idArray = flows.map((item) => item._id);
      const nodes = await ActivedNode.find({ flowId: { $in: idArray } });
      const edges = await ActivedEdge.find({ flowId: { $in: idArray } });

      const formatedFlows = flows.map((item) => {
        const newNodes = nodes.filter(
          (el) => el.flowId.toString() === item._id.toString()
        );
        const newEdges = edges.filter(
          (el) => el.flowId.toString() === item._id.toString()
        );

        const flow = {
          _id: item._id,
          title: item.title,
          status: item.status,
          createdAt: item.createdAt,
          finishedAt: item.finishedAt,
          comments: item.comments,
          posts: item.posts,
          enterpriseId,
          client: item.client,
          lastState: item.lastState,
          elements: [...newNodes, ...newEdges],
        };

        return flow;
      });

      if (process.env.REDIS_CLUSTER === "true")
        await set(
          `activedflows/${enterpriseId}`,
          JSON.stringify(formatedFlows)
        );

      res.send(formatedFlows);
    } catch (err) {
      res.status(422).send({ error: err.message });
    }
  } else {
    console.log("MEMORIA EM CACHE ENVIADA - FLUXOS ATIVOS");
    res.send(result);
  }
});

router.post("/actived-flows/actived-flow/new", async (req, res) => {
  const { flow, title, client, enterpriseId, version } = req.body;

  const nowLocal = moment().utcOffset(-180);

  try {
    const start = flow.elements.find((e) => e.type === "eventStart");
    const arrow = flow.elements.find((e) => e.source === start.id);
    const afterStart = flow.elements.find((e) => arrow.target === e.id);
    const doing = [afterStart.id];
    const doingEdges = [arrow.id];

    if (afterStart.type === "parallel") {
      doing.pop();

      flow.elements.map((e) => {
        if (e._id === afterStart._id) e.data.status = "done";
      });

      walkParallelLoop(flow.elements, flow.elements, afterStart, (node) => {
        if (node.source) {
          doingEdges.push(node.id);
        } else if (
          node.type === "task" ||
          node.type === "conditional" ||
          node.type === "timerEvent"
        ) {
          doing.push(node.id);
        } else if (node.type === "parallel") {
          node.data.status = "done";
        }
      });
    }

    const activedFlow = new ActivedFlow({
      title,
      client,
      status: doing,
      createdAt: nowLocal,
      enterpriseId,
    });

    await activedFlow.save();

    await Promise.all(
      flow.elements.map(async (item) => {
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
                ? { ...item.data, status: "pending" }
                : {
                    ...item.data,
                    status: test ? "done" : "pending",
                  },
            flowId: activedFlow._id,
            enterpriseId,
          });
          await edge.save();
        } else {
          let subtasks = [];

          if (item.type === "task") {
            item.data.subtasks.map((e) => {
              subtasks.push({ title: e, checked: false });
            });
          }

          const node = new ActivedNode({
            type: item.type,
            id: item.id,
            position: item.position,
            data:
              item.type === "task"
                ? {
                    ...item.data,
                    comments: "",
                    posts: [],
                    status: doing.find((e) => e === item.id)
                      ? "doing"
                      : "pending",
                    subtasks,
                    accountable: "Ninguém",
                    startedAt: doing.find((e) => e === item.id)
                      ? nowLocal
                      : undefined,
                  }
                : item.type === "timerEvent"
                ? {
                    ...item.data,
                    status: doing.find((e) => e === item.id)
                      ? "doing"
                      : "pending",
                    startedAt: doing.find((e) => e === item.id)
                      ? nowLocal
                      : undefined,
                  }
                : {
                    ...item.data,
                    status:
                      item.type === "eventStart"
                        ? "done"
                        : doing.find((e) => e === item.id)
                        ? "doing"
                        : item.data.status !== "model"
                        ? item.data.status
                        : "pending",
                  },
            flowId: activedFlow._id,
            targetPosition: item.targetPosition,
            sourcePosition: item.sourcePosition,
            enterpriseId,
          });
          await node.save();
        }
      })
    );

    const nodes = await ActivedNode.find({ flowId: activedFlow._id });
    const edges = await ActivedEdge.find({ flowId: activedFlow._id });

    if (process.env.REDIS_CLUSTER === "true")
      await del(`activedflows/${enterpriseId}`);

    res.status(200).json({
      flow: {
        _id: activedFlow._id,
        title: activedFlow.title,
        status: activedFlow.status,
        createdAt: activedFlow.createdAt,
        finishedAt: activedFlow.finishedAt,
        comments: activedFlow.comments,
        posts: activedFlow.posts,
        enterpriseId: activedFlow.enterpriseId,
        client: activedFlow.client,
        lastState: activedFlow.lastState,
        elements: [...nodes, ...edges],
      },
    });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

router.delete(
  "/actived-flows/actived-flow/delete/:flowId",
  async (req, res) => {
    const { flowId } = req.params;

    try {
      const flow = await ActivedFlow.findOne({ _id: flowId });

      await ActivedFlow.findOneAndRemove({ _id: flowId });

      await ActivedNode.remove({ flowId });
      await ActivedEdge.remove({ flowId });

      if (process.env.REDIS_CLUSTER === "true")
        await del(`activedflows/${flow.enterpriseId}`);

      res.send({ flowId });
    } catch (err) {
      res.status(422).send({ error: err.message });
    }
  }
);

router.put("/actived-flows/actived-flow/edit-comment", async (req, res) => {
  const { type, flowId, taskId, value } = req.body;

  try {
    let newItem;

    if (type === "flow") {
      newItem = await ActivedFlow.findOneAndUpdate(
        { _id: flowId },
        { comments: value },
        { new: true }
      );
    } else if (type === "task") {
      newItem = await ActivedNode.findOneAndUpdate(
        { flowId, id: taskId },
        { $set: { "data.comments": value } },
        { new: true }
      );
    }

    if (process.env.REDIS_CLUSTER === "true")
      await del(`activedflows/${newItem.enterpriseId}`);

    res.send({ itemId: newItem._id, type, comments: value, flowId });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

router.put("/actived-flows/actived-flow/edit-task", async (req, res) => {
  const { flowId, taskId, subtasks, accountable } = req.body;

  try {
    const newTask = await ActivedNode.findOneAndUpdate(
      { flowId, id: taskId },
      { $set: { "data.subtasks": subtasks, "data.accountable": accountable } },
      { new: true }
    );

    if (process.env.REDIS_CLUSTER === "true")
      await del(`activedflows/${newTask.enterpriseId}`);

    res.send({ newTask });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

router.put("/actived-flows/actived-flow/send-task", async (req, res) => {
  const { flowId, taskId, edgeId } = req.body;

  const nowLocal = moment().utcOffset(-180);

  try {
    //////////////ATUAL

    const taskExpired = await ActivedNode.findOne({ _id: taskId });

    const subtasks = taskExpired.data.subtasks.map((item) => {
      return { ...item, checked: true };
    });

    const nodes = await ActivedNode.find({ flowId });
    const edges = await ActivedEdge.find({ flowId });

    await ActivedFlow.findByIdAndUpdate(flowId, {
      lastState: [...nodes, ...edges],
    });

    const taskUpdated = await ActivedNode.findOneAndUpdate(
      { _id: taskId },
      {
        $set: {
          "data.status": "done",
          "data.finishedAt": nowLocal,
          "data.expired":
            moment(taskExpired.data.startedAt)
              .add(taskExpired.data.expiration.number, "hours")
              .diff(nowLocal, "hours", true) < 0
              ? true
              : false,
          "data.subtasks": subtasks,
        },
      }
    );

    let arrowUpdated;

    if (taskUpdated.type === "task") {
      arrowUpdated = await ActivedEdge.findOneAndUpdate(
        { source: taskUpdated.id, flowId },
        { $set: { "data.status": "done" } }
      );
    } else {
      arrowUpdated = await ActivedEdge.findOneAndUpdate(
        { _id: edgeId },
        { $set: { "data.status": "done" } }
      );
    }

    ////////PROXIMO
    const nextTask = await ActivedNode.findOne({
      id: arrowUpdated.target,
      flowId,
    });

    //////////Tarefa ou condicional
    if (
      nextTask.type === "task" ||
      nextTask.type === "conditional" ||
      nextTask.type === "timerEvent"
    ) {
      const nodes = await ActivedNode.find({ flowId });

      await ActivedNode.findOneAndUpdate(
        { _id: nextTask._id },
        { $set: { "data.status": "doing", "data.startedAt": nowLocal } }
      );

      if (newStatus[0] !== "finished") {
        filter = nodes.filter(
          (item) =>
            item.data.status === "doing" &&
            (item.type === "task" ||
              item.type === "conditional" ||
              item.type === "timerEvent")
        );
        newStatus = filter.map((item) => item.id);
        if (
          nextTask.type === "task" ||
          nextTask.type === "conditional" ||
          nextTask.type === "timerEvent"
        )
          newStatus.push(nextTask.id);
      }
    } else if (nextTask.type === "parallel") {
      const edges = await ActivedEdge.find({ flowId });
      const nodes = await ActivedNode.find({ flowId });

      nodes.map((item) =>
        item.id === nextTask.id ? (item.data.status = "done") : null
      );

      walkParallelLoop(nodes, edges, nextTask, (node) => {
        if (node.source) {
          node.data.status = "done";
        }
        if (node.type === "task") {
          node.data.startedAt = nowLocal;
          node.data.status = "doing";
        }
        if (node.type === "timerEvent") {
          node.data.startedAt = nowLocal;
          node.data.status = "doing";
        }
        if (node.type === "conditional") {
          node.data.startedAt = nowLocal;
          node.data.status = "doing";
        }
        if (node.type === "parallel") {
          node.data.status = "done";
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

      if (newStatus[0] !== "finished") {
        filter = nodes.filter(
          (item) =>
            item.data.status === "doing" &&
            (item.type === "task" ||
              item.type === "conditional" ||
              item.type === "timerEvent")
        );
        newStatus = filter.map((item) => item.id);
        if (
          nextTask.type === "task" ||
          nextTask.type === "conditional" ||
          nextTask.type === "timerEvent"
        )
          newStatus.push(nextTask.id);
      }
    } else if (
      nextTask.type === "parallelEnd" ||
      nextTask.type === "conditionalEnd"
    ) {
      const edges = await ActivedEdge.find({ flowId });
      const nodes = await ActivedNode.find({ flowId });

      walkEndLoop(
        nodes,
        edges,
        edges.find((e) => e.target === nextTask.id),
        (node) => {
          if (node.type === "conditionalEnd" || node.type === "parallelEnd") {
            node.data.status = "done";
          }
          if (node.source) {
            node.data.status = "done";
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

      if (newStatus[0] !== "finished") {
        filter = nodes.filter(
          (item) =>
            item.data.status === "doing" &&
            (item.type === "task" ||
              item.type === "conditional" ||
              item.type === "timerEvent")
        );
        newStatus = filter.map((item) => item.id);
        if (
          nextTask.type === "task" ||
          nextTask.type === "conditional" ||
          nextTask.type === "timerEvent"
        )
          newStatus.push(nextTask.id);
      }
    } else if (nextTask.type === "eventEnd") {
      newStatus = ["finished"];

      await ActivedNode.findOneAndUpdate(
        { _id: nextTask._id },
        { $set: { "data.status": "done" } }
      );
    }

    if (newStatus[0] === "finished") {
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
      enterpriseId: activedFlow.enterpriseId,
      client: activedFlow.client,
      lastState: activedFlow.lastState,
      elements: [...newNodes, ...newEdges],
    };

    if (process.env.REDIS_CLUSTER === "true")
      await del(`activedflows/${activedFlow.enterpriseId}`);

    res.status(200).json({
      flow,
    });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

router.put("/actived-flows/actived-flow/flow-post/new", async (req, res) => {
  const { flowId, newFlowPost } = req.body;

  try {
    const flow = await ActivedFlow.findOne({ _id: flowId });

    const posts = flow.posts;

    posts.push(newFlowPost);

    const newFlow = await ActivedFlow.findOneAndUpdate(
      { _id: flowId },
      { posts },
      { new: true }
    );

    if (process.env.REDIS_CLUSTER === "true")
      await del(`activedflows/${newFlow.enterpriseId}`);

    res.send({ newFlow });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

router.put("/actived-flows/actived-flow/undo-task", async (req, res) => {
  const { flowId } = req.body;

  try {
    const flow = await ActivedFlow.findById(flowId.flowId);

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
      flowId.flowId,
      { lastState: [] },
      { new: true }
    );
    const nodes = await ActivedNode.find({ flowId: flowId.flowId });
    const edges = await ActivedEdge.find({ flowId: flowId.flowId });

    if (process.env.REDIS_CLUSTER === "true")
      await del(`activedflows/${newFlow.enterpriseId}`);

    res.send({
      newFlow: {
        _id: newFlow._id,
        title: newFlow.title,
        status: newFlow.status,
        createdAt: newFlow.createdAt,
        finishedAt: newFlow.finishedAt,
        comments: newFlow.comments,
        posts: newFlow.posts,
        enterpriseId: newFlow.enterpriseId,
        client: newFlow.client,
        lastState: newFlow.lastState,
        elements: [...nodes, ...edges],
      },
    });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

router.put("/actived-flows/actived-flow/assign-tasks", async (req, res) => {
  const { flowId, employeer } = req.body;

  try {
    await ActivedNode.updateMany(
      { type: "task", flowId },
      { "data.accountable": employeer }
    );

    const flow = await ActivedFlow.findById(flowId);
    const nodes = await ActivedNode.find({ flowId });
    const edges = await ActivedEdge.find({ flowId });

    if (process.env.REDIS_CLUSTER === "true")
      await del(`activedflows/${flow.enterpriseId}`);

    res.send({
      flow: {
        _id: flow._id,
        title: flow.title,
        status: flow.status,
        createdAt: flow.createdAt,
        finishedAt: flow.finishedAt,
        comments: flow.comments,
        posts: flow.posts,
        enterpriseId: flow.enterpriseId,
        client: flow.client,
        lastState: flow.lastState,
        elements: [...nodes, ...edges],
      },
    });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

router.put(
  "/actived-flows/actived-flow/task/new-file",
  upload.single("file"),
  async (req, res) => {
    const task = await ActivedNode.findOneAndUpdate(
      { _id: req.body.taskId },
      {
        $set: {
          "data.file": {
            path: "./files/" + req.file.filename,
            name: req.file.filename,
            size: req.file.size,
            uploaded: true,
          },
        },
      },
      { new: true }
    );

    if (process.env.REDIS_CLUSTER === "true")
      await del(`activedflows/${task.enterpriseId}`);

    res.send({ file: task.data.file, taskId: task._id, flowId: task.flowId });
  }
);

router.put("/actived-flows/actived-flow/task/remove-file", async (req, res) => {
  const { path, taskId } = req.body;

  const unlinkAsync = promisify(fs.unlink);
  await unlinkAsync(path);

  const task = await ActivedNode.findOneAndUpdate(
    { _id: taskId },
    { $set: { "data.file": null } },
    { new: true }
  );

  if (process.env.REDIS_CLUSTER === "true")
    await del(`activedflows/${task.enterpriseId}`);

  res.send({ taskId: task._id, flowId: task.flowId });
});

router.put("/actived-flows/actived-flow/task/new-subtask", async (req, res) => {
  const { taskId, subtask } = req.body;

  try {
    const newNode = await ActivedNode.findOneAndUpdate(
      { _id: taskId },
      { $push: { "data.subtasks": { title: subtask, checked: false } } },
      { new: true }
    );

    if (process.env.REDIS_CLUSTER === "true")
      await del(`activedflows/${newNode.enterpriseId}`);

    res.send({ newNode });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

router.put(
  "/actived-flows/actived-flow/task/remove-subtask",
  async (req, res) => {
    const { taskId, subtask } = req.body;

    try {
      const newNode = await ActivedNode.findOneAndUpdate(
        { _id: taskId },
        { $pull: { "data.subtasks": subtask } },
        { new: true }
      );

      if (process.env.REDIS_CLUSTER === "true")
        await del(`activedflows/${newNode.enterpriseId}`);

      res.send({ newNode });
    } catch (err) {
      res.status(422).send({ error: err.message });
    }
  }
);

router.put(
  "/actived-flows/actived-flow/task/edit-subtask",
  async (req, res) => {
    const { taskId, subtask, prevValue } = req.body;

    try {
      const task = await ActivedNode.findOne({ _id: taskId });

      const subtasks = task.data.subtasks.map((item) => {
        if (item.title === prevValue) {
          return { ...item, title: subtask };
        } else {
          return item;
        }
      });

      const newNode = await ActivedNode.findOneAndUpdate(
        { _id: taskId },
        { $set: { "data.subtasks": subtasks } },
        { new: true }
      );

      if (process.env.REDIS_CLUSTER === "true")
        await del(`activedflows/${newNode.enterpriseId}`);

      res.send({ newNode });
    } catch (err) {
      res.status(422).send({ error: err.message });
    }
  }
);

router.put("/actived-flows/actived-flow/task/new-title", async (req, res) => {
  const { taskId, title } = req.body;

  try {
    const newNode = await ActivedNode.findOneAndUpdate(
      { _id: taskId },
      { $set: { "data.label": title } },
      { new: true }
    );

    if (process.env.REDIS_CLUSTER === "true")
      await del(`activedflows/${newNode.enterpriseId}`);

    res.status(200).send({ newNode });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

router.put("/actived-flows/actived-flow/new-title", async (req, res) => {
  const { flowId, title } = req.body;

  try {
    const newFlow = await ActivedFlow.findOneAndUpdate(
      { _id: flowId },
      { $set: { title: title } },
      { new: true }
    );

    if (process.env.REDIS_CLUSTER === "true")
      await del(`activedflows/${newFlow.enterpriseId}`);

    res.status(200).send({ newFlow });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

router.put("/actived-flows/actived-flow/task/new-post", async (req, res) => {
  const { taskId, newPost } = req.body;

  try {
    const task = await ActivedNode.findOne({ _id: taskId });

    const posts = task.data.posts;

    posts.push(newPost);

    const newTask = await ActivedNode.findOneAndUpdate(
      { _id: taskId },
      { "data.posts": posts },
      { new: true }
    );

    if (process.env.REDIS_CLUSTER === "true")
      await del(`activedflows/${task.enterpriseId}`);

    res.send({ newTask });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

router.put(
  "/actived-flows/actived-flow/task/new-subtask-post",
  async (req, res) => {
    const { taskId, newPostSubtask, subtask } = req.body;

    try {
      const task = await ActivedNode.findOne({ _id: taskId });

      const subtasks = task.data.subtasks.map((item, index) => {
        if (index === subtask) {
          return {
            ...item,
            posts:
              item.posts?.length > 0
                ? [...item.posts, newPostSubtask]
                : [newPostSubtask],
          };
        } else {
          return item;
        }
      });

      const newTask = await ActivedNode.findOneAndUpdate(
        { _id: taskId },
        { $set: { "data.subtasks": subtasks } },
        { new: true }
      );

      if (process.env.REDIS_CLUSTER === "true")
        await del(`activedflows/${newTask.enterpriseId}`);

      res.send({ newTask });
    } catch (err) {
      res.status(422).send({ error: err.message });
    }
  }
);

module.exports = router;
