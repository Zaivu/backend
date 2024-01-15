const express = require("express");
const mongoose = require("mongoose");
const ObjectID = require("mongodb").ObjectID;
const exceptions = require("../exceptions");
const requireAuth = require("../middlewares/requireAuth");

const router = express.Router();
const { DateTime } = require("luxon");
const { randomUUID } = require("crypto");

const ActivedFlow = mongoose.model("ActivedFlow");
const ActivedEdge = mongoose.model("ActivedEdge");
const ActivedNode = mongoose.model("ActivedNode");
const ChatMessage = mongoose.model("ChatMessage");
const BackgroundJobs = mongoose.model("BackgroundJobs");

const Node = mongoose.model("Node");
const Edge = mongoose.model("Edge");
const Post = mongoose.model("Post");

const User = mongoose.model("User");
const multerConfig = require("../config/multer");
const multer = require("multer");
const checkPermission = require("../middlewares/userPermission");
const sendAllJobs = require("../utils/sendAllJobs");
const sendMentions = require("../utils/sendMentions");
const { confirmNode } = require("../lambdas/confirm-node");
const addActivedFlow = require("../utils/addActivedFlow");

router.use(requireAuth);

async function getAccountableUsers(nodes) {
  let relatedUsers = [];
  await Promise.all(
    nodes.map(async (n) => {
      const userId = n.data.accountable?.userId;

      if (userId) {
        let avatarURL = process.env.DEFAULT_PROFILE_PICTURE;
        const hasPicture = await Post.findOne({
          originalId: userId,
          type: "avatar",
        });

        const currentUser = await User.findOne({ _id: userId });

        if (hasPicture) {
          avatarURL = hasPicture.url;
        }

        relatedUsers.push({
          ...n.data.accountable,
          avatarURL,
          username: currentUser.username,
        });
      }
      return n;
    })
  );
  return relatedUsers.filter((obj, index) => {
    // Check if the current object is unique by comparing it with the previous objects
    for (let i = 0; i < index; i++) {
      if (JSON.stringify(obj) === JSON.stringify(relatedUsers[i])) {
        return false; // Found a duplicate, exclude the object
      }
    }
    return true; // Object is unique
  });
}

async function getAvatar(userId) {
  let avatar = process.env.DEFAULT_PROFILE_PICTURE;
  const hasPicture = await Post.findOne({ originalId: userId, type: "avatar" });

  if (hasPicture) {
    avatar = hasPicture.url;
  }

  return avatar;
}

//Pagination
router.get("/pagination/:page", checkPermission, async (req, res) => {
  const { page = "1" } = req.params;
  const {
    title = "",
    client = "",
    alpha = false,
    creation = false,
  } = req.query;

  const user = req.user;
  const tenantId = user.tenantId ? user.tenantId : user._id;

  const isAlpha = alpha === "true"; //Ordem do alfabeto
  const isCreation = creation === "true"; //Ordem de Criação

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
      sort: { ...SortedBy, _id: 1 }, // ultimas instancias
    };

    const Pagination = await ActivedFlow.paginate(
      {
        tenantId,
        finishedAt: null,
        isDeleted: false,
        title: { $regex: title, $options: "i" },
        client: { $regex: client, $options: "i" },
      },
      paginateOptions
    );

    const flows = Pagination.docs;
    const totalPages = Pagination.totalPages;

    const flowsElements = await Promise.all(
      flows.map(async (item) => {
        const nodes = await ActivedNode.find({ flowId: item._id });

        const relatedUsers = await getAccountableUsers(nodes);

        const edges = await ActivedEdge.find({ flowId: item._id });

        return {
          ...item._doc,
          relatedUsers,
          elements: [...nodes, ...edges],
        };
      })
    );

    res.send({ activedflows: flowsElements, pages: totalPages });
  } catch (err) {
    console.log(err);
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

// Finished Flows Pagination
router.get("/pagination/history/:page", checkPermission, async (req, res) => {
  const { page = "1" } = req.params;
  const {
    title = "",
    client = "",
    alpha = false,
    creation = false,
    finishedAt = false,
  } = req.query;
  const user = req.user;
  const tenantId = user.tenantId ? user.tenantId : user._id;

  const isAlpha = alpha === "true"; //Ordem do alfabeto
  const isCreation = creation === "true"; //Ordem de Criação
  const isFinishedAt = finishedAt === "true"; //Ordem de Conclusão

  const SortedBy = isCreation
    ? { createdAt: 1 }
    : isAlpha
    ? { title: 1 }
    : isFinishedAt
    ? { finishedAt: -1 } // Variavel da Ordem de conclusão //! Em Teste
    : { createdAt: -1 };

  try {
    const paginateOptions = {
      page,
      limit: 4,
      sort: SortedBy, // ultimas instancias
      collation: { locale: "en", strength: 2 }, // Perform case-insensitive sort
    };

    const Pagination = await ActivedFlow.paginate(
      {
        tenantId,
        isDeleted: false,
        status: ["finished"],
        title: { $regex: title, $options: "i" },
        client: { $regex: client, $options: "i" },
      },
      paginateOptions
    );

    const flows = Pagination.docs;
    const totalPages = Pagination.totalPages;

    const response = await Promise.all(
      flows.map(async (item) => {
        const nodes = await ActivedNode.find({
          flowId: item._id,
          "data.accountable.userId": { $exists: true },
        });

        const relatedUsers = await getAccountableUsers(nodes);
        return {
          tenantId: item.tenantId,
          _id: item._id,
          title: item.title,
          description: item.description,
          createdAt: item.createdAt,
          finishedAt: item.finishedAt,
          client: item.client,
          accountable: item.accountable,
          relatedUsers,
        };
      })
    );

    //Selector of information

    res.send({ activedflows: response, pages: totalPages });
  } catch (err) {
    console.log(err);
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

//Single Flow
router.get("/flow/:flowId", async (req, res) => {
  const { flowId } = req.params;

  const user = req.user;
  const tenantId = user.tenantId ? user.tenantId : user._id;

  try {
    if (!ObjectID.isValid(flowId)) {
      throw exceptions.unprocessableEntity("flowId must be a valid ObjectId");
    }

    const flow = await ActivedFlow.findOne({ _id: flowId, tenantId });
    if (!flow) {
      throw exceptions.entityNotFound();
    }

    let flowAccountable;
    const userAcc = flow.accountable?.userId ?? null;

    if (userAcc) {
      const accUser = await User.findOne({ _id: userAcc });
      const avatarURL = await getAvatar(userAcc);

      flowAccountable = {
        avatarURL,
        _id: userAcc?._id,
        username: accUser.username,
        email: accUser.email,
      };
    }

    const nodes = await ActivedNode.find({ flowId: flow._id });
    const edges = await ActivedEdge.find({ flowId: flow._id });

    let newNodes = nodes.filter(
      (el) => el.flowId.toString() === flow._id.toString()
    );
    const newNodesWithPosts = await Promise.all(
      newNodes.map(async (item) => {
        if (item.type === "task") {
          let newItem = JSON.parse(JSON.stringify(item));
          newItem.data.attachLength = await Post.count({
            originalId: item._id,
          });
          const userId = item.data.accountable?.userId;

          if (userId) {
            let avatarURL = process.env.DEFAULT_PROFILE_PICTURE;
            const hasPicture = await Post.findOne({
              originalId: userId,
              type: "avatar",
            });

            const currentUser = await User.findOne({ _id: userId });

            if (hasPicture) {
              avatarURL = hasPicture.url;
            }

            const accountable = {
              ...item.data.accountable,
              avatarURL,
              username: currentUser.username,
            };

            return { ...newItem, data: { ...item.data, accountable } };
          }

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
      accountable: flowAccountable,
      elements: [...newNodesWithPosts, ...newEdges],
    };
    res.send({ flow: newFlow });
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

//get Files
router.get("/files/:originalId", async (req, res) => {
  const { originalId } = req.params;

  try {
    const posts = await Post.find({ originalId });
    res.status(200).send(posts);
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

//Get all log messages from task id
router.get("/chat/task/:refId", async (req, res) => {
  try {
    const { refId } = req.params;

    const chatLog = await ChatMessage.find({ refId, type: "task" }).sort({
      createdAt: -1,
    });

    const chatWithAvatars = await Promise.all(
      chatLog.map(async (chat) => {
        const avatar = await getAvatar(chat.userId);
        const plainChat = chat.toObject({ getters: true, virtuals: true });
        return { ...plainChat, avatarURL: avatar };
      })
    );

    res.status(200).send({ chatLog: chatWithAvatars });
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});
//Get all log messages from flow id
router.get("/chat/flow/:refId", async (req, res) => {
  try {
    const { refId } = req.params;

    const chatLog = await ChatMessage.find({ refId, type: "flow" }).sort({
      createdAt: -1,
    });

    const chatWithAvatars = await Promise.all(
      chatLog.map(async (chat) => {
        const avatar = await getAvatar(chat.userId);
        const plainChat = chat.toObject({ getters: true, virtuals: true });
        return { ...plainChat, avatarURL: avatar };
      })
    );

    res.status(200).send({ chatLog: chatWithAvatars });
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});
//Add Active Flow
router.post("/new", checkPermission, async (req, res) => {
  try {
    const { flowId, title, client = "", description } = req.body;
    const user = req.user;
    const tenantId = user.tenantId ? user.tenantId : user._id;

    const nowLocal = DateTime.now();

    const alreadyExist = await ActivedFlow.findOne({ title, isDeleted: false });
    if (alreadyExist) {
      throw exceptions.alreadyExists();
    }

    const nodes = await Node.find({ flowId });
    const edges = await Edge.find({ flowId });

    let baseModel = {
      title,
      tenantId,
      description,
      client,
      createdAt: nowLocal.toMillis(),
      lastUpdate: nowLocal.toMillis(),
      accountable: {
        userId: user._id,
      },
    };

    const elements = { nodes, edges };

    const acFlow = await addActivedFlow(baseModel, elements);

    const eventStart = acFlow.elements.find(
      (item) => item.type === "eventStart"
    );
    const { _id: taskId } = eventStart;

    const payload = {
      nodeId: taskId,
      userId: user._id,
    };
    const response = await confirmNode(payload); //lambda

    const body = JSON.parse(response.body);
    const backgroundJobs = body.action.backgroundJobs;

    const options = {
      userId: body.from.userId,
      flowId: body.action.flowId,
      type: "ConfirmNode",
    };

    await sendAllJobs(backgroundJobs, options, BackgroundJobs);

    res.status(200).json({
      flow: { flowId: acFlow._id, title: acFlow.title },
    });
  } catch (err) {
    console.log(err);
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});
//Send Chat Message
router.post("/chat/new", async (req, res) => {
  try {
    const { userId, username, message, type, ref } = req.body;

    const avatarURL = await getAvatar(userId);

    const baseModel = {
      userId,
      refId: type === "task" ? ref.taskId : ref.flowId,
      username,
      message,
      type,
    };

    const model = new ChatMessage({
      ...baseModel,
      createdAt: DateTime.now(),
    });

    const chatMessage = await model.save();
    await sendMentions(chatMessage, ref);

    const plainChat = chatMessage.toObject({ getters: true, virtuals: true });
    res.send({ chatMessage: { ...plainChat, avatarURL } });
  } catch (err) {
    console.log(err);
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

//add Subtask
router.post("/task/subtask/new", async (req, res) => {
  try {
    const { taskId, title = "Subtarefa", checked = false } = req.body;

    const randomId = randomUUID();

    const taskUpdated = await ActivedNode.findOneAndUpdate(
      { _id: taskId },
      {
        $push: {
          "data.subtasks": {
            title: title + " " + DateTime.now(),
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
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

//new File
router.post(
  "/new-file",
  multer(multerConfig).single("file"),
  async (req, res) => {
    const { originalname: name, size, key, location: url = "" } = req.file;
    const { originalId, type, tenantId } = req.body;

    try {
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
    } catch (err) {
      const code = err.code ? err.code : "412";
      res.status(code).send({ error: err.message, code });
    }
  }
);

//Update flow Accountable
router.put("/accountable/", checkPermission, async (req, res) => {
  const { userId, id: flowId } = req.body;

  try {
    const user = await User.findOne({ _id: userId });
    const flow = await ActivedFlow.findOneAndUpdate(
      { _id: flowId },
      { accountable: { userId: user._id } },
      { new: true }
    );

    const avatarURL = await getAvatar(user._id);

    res.status(200).send({
      flowId: flow._id,
      accountable: {
        avatarURL,
        userId: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

//update Subtask
router.put("/task/subtask/update", async (req, res) => {
  try {
    const { taskId, id, title = "", checked = false } = req.body;

    const currentTask = await ActivedNode.findById({ _id: taskId });

    const allSubtasks = currentTask.data.subtasks;

    const updatingSubtasks = allSubtasks.map((item) =>
      item.id === id ? (item = { ...item, title, checked }) : item
    );

    const taskUpdated = await ActivedNode.findOneAndUpdate(
      { _id: taskId },
      {
        $set: { "data.subtasks": updatingSubtasks },
      },
      {
        new: true,
      }
    );

    const subtasks = taskUpdated.data.subtasks;

    res.send({ subtasks, taskId: taskUpdated._id });
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

//Confirm task | conditional option
router.put("/node/confirm", async (req, res) => {
  const { flowId, taskId, edgeId } = req.body;
  const user = req.user;

  // const tenantId = user.tenantId ? user.tenantId : user._id;

  try {
    //////////////ATUAL
    const payload = {
      nodeId: taskId,
      userId: user._id,
      edgeId,
    };
    const response = await confirmNode(payload); //lambda
    const statusCode = response.statusCode;

    if (statusCode === 500)
      throw exceptions.unprocessableEntity(
        "Lambda Error - Node Confirm",
        response
      );

    const body = JSON.parse(response.body);
    const backgroundJobs = body.action.backgroundJobs;

    const options = {
      userId: body.from.userId,
      flowId: body.action.flowId,
      type: "ConfirmNode",
    };

    await sendAllJobs(backgroundJobs, options, BackgroundJobs);
    const activedFlow = await ActivedFlow.findById(flowId);
    const newNodes = await ActivedNode.find({ flowId: flowId });

    const newNodesWithAvatars = await Promise.all(
      newNodes.map(async (item) => {
        if (item.type === "task") {
          const userId = item.data.accountable?.userId ?? null;

          if (userId) {
            const user = await User.findOne({ _id: userId });
            const avatarURL = await getAvatar(userId);

            const accountable = {
              ...item.data.accountable,
              avatarURL,
              username: user.username,
            };
            const node = item.toObject({ getters: true, virtuals: true });
            return { ...node, data: { ...item.data, accountable } };
          }

          return item;
        } else {
          return item;
        }
      })
    );

    const newEdges = await ActivedEdge.find({ flowId: flowId });

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
      elements: [...newNodesWithAvatars, ...newEdges],
    };

    res.status(200).json({
      flow,
    });
  } catch (err) {
    console.log(err);
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

//undo lastState
router.put("/undo", checkPermission, async (req, res) => {
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

    const newNodesWithAvatars = await Promise.all(
      nodes.map(async (item) => {
        if (item.type === "task") {
          const userId = item.data.accountable?.userId ?? null;

          if (userId) {
            const user = await User.findOne({ _id: userId });
            const avatarURL = await getAvatar(userId);

            const accountable = {
              ...item.data.accountable,
              avatarURL,
              username: user.username,
            };
            const node = item.toObject({ getters: true, virtuals: true });
            return { ...node, data: { ...item.data, accountable } };
          }

          return item;
        } else {
          return item;
        }
      })
    );

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
        elements: [...newNodesWithAvatars, ...edges],
      },
    });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

//update Subtask
router.put("/task/description", async (req, res) => {
  try {
    const { taskId, description = "" } = req.body;

    const taskUpdated = await ActivedNode.findOneAndUpdate(
      { _id: taskId },
      {
        $set: { "data.comments": description },
      },
      {
        new: true,
      }
    );

    const newDescription = taskUpdated.data.comments;

    res.send({ description: newDescription, taskId: taskUpdated._id });
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

//? New Delete Actived Flow
router.put("/delete/", checkPermission, async (req, res) => {
  const { flowId } = req.body;
  try {
    const response = await ActivedFlow.findByIdAndUpdate(flowId, {
      isDeleted: true,
    });

    await ActivedNode.updateMany(
      { flowId },
      { $set: { isDeleted: true } },
      { new: true }
    );
    await ActivedEdge.updateMany(
      { flowId },
      { $set: { isDeleted: true } },
      { new: true }
    );

    res.send({ response }).status(200);
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

//Remove flow Accountable
router.delete("/accountable/:id", checkPermission, async (req, res) => {
  const { id: flowId } = req.params;

  try {
    const flow = await ActivedFlow.findOneAndUpdate(
      { _id: flowId },
      { accountable: null },
      { new: true }
    );

    res.status(200).send({ flowId: flow._id, accountable: null });
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

//removeSubtask
router.delete("/task/subtask/delete/:taskId/:id", async (req, res) => {
  try {
    const { taskId, id } = req.params;

    const currentTask = await ActivedNode.findById({ _id: taskId });

    const allSubtasks = currentTask.data.subtasks;

    const updatingSubtasks = allSubtasks.filter((item) => item.id !== id);

    const taskUpdated = await ActivedNode.findOneAndUpdate(
      { _id: taskId },
      {
        $set: { "data.subtasks": updatingSubtasks },
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

//Delete File
router.delete("/remove-file/:fileId", async (req, res) => {
  const { fileId } = req.params;

  try {
    const post = await Post.findById(fileId);

    await post.remove();

    res.send();
  } catch (err) {
    const code = err.code ? err.code : "412";
    res.status(code).send({ error: err.message, code });
  }
});

//? Adding CustomNotes Routes

//add CustomNote
router.post("/customnote", async (req, res) => {
  try {
    const { flowId, position, id } = req.body;
    const user = req.user;

    // Check for missing required fields
    if (!flowId || !position || Object.keys(position).length === 0) {
      return res.status(400).send("Missing required fields");
    }

    const tenantId = user.tenantId ? user.tenantId : user._id;

    const activeFlow = await ActivedFlow.findById(flowId);

    if (!activeFlow) {
      return res.status(404).send("ActiveFlow not found");
    }

    const activedNode = new ActivedNode({
      type: "CustomNote",
      position: position || { x: 0, y: 0 },
      tenantId: tenantId,
      flowId: flowId,
      id: id,
      data: {
        label: "New note",
        text: "",
        color: "rgba(255, 207, 153, 1.0)",
        textColor: "#000000",
        textSize: "16",
        width: 200,
        height: 50,
        lock: true,
      },
    });

    await activedNode.save();

    res
      .status(200)
      .json({ message: "Custom note added successfully", activedNode });
  } catch (err) {
    const code = err.code ? err.code : "500";
    res.status(code).send({ error: err.message, code });
  }
});

//remove CustomNote

router.delete("/customnote/:noteId", async (req, res) => {
  try {
    const { noteId } = req.params;

    if (!noteId) {
      return res.status(400).send("Note ID is required");
    }

    const activedNode = await ActivedNode.findOne({
      id: noteId,
      type: "CustomNote",
    });

    if (!activedNode) {
      return res.status(404).send("Custom note not found");
    }

    await activedNode.remove();

    res
      .status(200)
      .json({ message: "Custom note deleted successfully", id: noteId });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});
// Modify the Custom Notes Data and Location.

router.put("/customnote/data", async (req, res) => {
  try {
    const { noteId, newData } = req.body;

    if (!noteId || !newData) {
      return res
        .status(400)
        .send("Missing required fields: noteId and/or NoteData");
    }

    const activedNode = await ActivedNode.findOneAndUpdate(
      { id: noteId, type: "CustomNote" },
      { $set: { data: newData } },
      { new: true }
    );

    if (!activedNode) {
      return res.status(404).send("Custom note not found");
    }

    res.status(200).json({
      message: "Custom note data updated successfully",
      data: activedNode,
    });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

router.put("/customnote/location", async (req, res) => {
  try {
    const { noteId, newPosition } = req.body;

    if (!noteId || !newPosition) {
      return res
        .status(400)
        .send("Missing required fields: noteId and/or newPosition");
    }

    const activedNode = await ActivedNode.findOneAndUpdate(
      { id: noteId, type: "CustomNote" },
      { $set: { position: newPosition } },
      { new: true }
    );

    if (!activedNode) {
      return res.status(404).send("Custom note not found");
    }

    res.status(200).json({
      message: "Custom note location updated successfully",
      data: activedNode,
    });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

module.exports = router;
