const User = require("../models/User");
const ActivedNode = require("../models/ActivedNode");
const ActivedFlow = require("../models/ActivedFlow");
const Post = require("../models/Post");
const ChatMessage = require("../models/ChatMessage");
const { DateTime } = require("luxon");
const getAvatar = require("../utils/getUserAvatar");
const getMomentStatus = require("../utils/getMomentStatus");

class ActivedTasksRepository {
  async pagination(user, rank, queries, page) {
    const {
      flowTitle = "",
      label = "",
      client = "",
      taskId = false,
      alpha = false,
      creation = false,
      status = "doing", // 'doing' || 'late' || 'pending || done'
      tasksACC = true,
    } = queries;

    const today = DateTime.now();

    const tenantId = user.tenantId ? user.tenantId : user._id;

    const isAlpha = alpha === "true"; //Ordem do alfabeto
    const isCreation = creation === "true"; //Ordem de Criação
    const isTasksACC = tasksACC === "true";
    const isTaskID = taskId === "null" ? null : taskId;

    const SortedBy = isCreation
      ? { "data.startedAt": 1 }
      : isAlpha
      ? { "data.label": 1 }
      : { "data.startedAt": -1 };

    const paginateOptions = {
      page,
      limit: 10,
      sort: { ...SortedBy, _id: 1 }, // ultimas instancias
    };

    const allProjects = await ActivedFlow.find({
      isDeleted: false,
      tenantId,
      client: { $regex: client, $options: "i" },
      title: { $regex: flowTitle, $options: "i" },
    });

    const projects = allProjects.map(
      (item) => (item = { title: item.title, flowId: item._id })
    );

    const ids = projects.map((item) => item.flowId);

    const currentStatus =
      status === "late" || status === "doing" ? "doing" : status;

    const query = {
      tenantId,
      flowId: ids,
      type: "task",
      "data.label": { $regex: label, $options: "i" },
      "data.status": currentStatus,
      ...(isTaskID && { _id: taskId }),
    };

    if (currentStatus === "doing") {
      query["data.expiration.date"] =
        status === "late"
          ? { $lt: today.toMillis() }
          : { $gt: today.toMillis() };

      if (rank === "colaborador" || isTasksACC) {
        query["data.accountable.userId"] = user._id;
      }
    } else {
      if (rank === "colaborador" || isTasksACC) {
        query["data.accountable.userId"] = user._id;
      }
    }

    const Pagination = await ActivedNode.paginate(query, paginateOptions);

    const taskPagination = await Promise.all(
      Pagination.docs.map(async (item) => {
        const currentProject = projects.find((p) => {
          const comparison =
            JSON.stringify(item.flowId) === JSON.stringify(p.flowId);

          if (comparison) {
            return p;
          }
        });

        if (currentProject) {
          const files = await Post.find({ originalId: item._id });
          const chatMessages = await ChatMessage.find({ refId: item._id });

          const accUser = item.data.accountable?.userId ?? null;

          let accountable = null;
          if (accUser) {
            const user = await User.findOne({ _id: accUser });
            const avatarURL = await getAvatar(accUser);

            accountable = {
              userId: accUser,
              username: user.username,
              avatarURL: avatarURL,
            };
          }

          const moment = getMomentStatus(item);

          const task = {
            label: item.data.label,
            _id: item._id,
            type: item.type,
            status: item.data.status,
            description: item.data.comments,
            subtasks: item.data.subtasks,
            duration: item.data.expiration.number,
            moment: moment,
            flowId: item.flowId,
            projectName: currentProject.title,
            files: files.length,
            chatMessages: chatMessages.length,
            accountable,
          };

          return task;
        }
      })
    );

    const totalPages = Pagination.totalPages;

    return { pagination: taskPagination, totalPages, today };
  }

  async getUser(query) {
    return await User.findOne(query);
  }
  async getTask(query) {
    return await ActivedNode.findOne(query);
  }
  async setAccountable(task, user) {
    const taskId = task._id;
    const tenantId = task.tenantId;
    const userId = user._id;
    const username = user.username;
    await ActivedNode.findOneAndUpdate(
      { _id: taskId, tenantId },
      { "data.accountable": { userId } },
      { new: true }
    );

    const avatarURL = await getAvatar(userId);

    return {
      taskId,
      accountable: { avatarURL, userId, username },
    };
  }

  async setAccountableMultiple(tasksList, user, tenantId) {
    const userId = user._id;
    const username = user.username;

    await Promise.all(
      tasksList.map(async (item) => {
        const task = await ActivedNode.findOneAndUpdate(
          { _id: item.taskId, tenantId },
          { "data.accountable": { userId } },
          { new: true }
        );
        return task;
      })
    );

    const avatarURL = await getAvatar(userId);

    return {
      list: tasksList,
      accountable: { avatarURL, userId, username },
    };
  }

  async setLabel(task, label) {
    const taskId = task._id;
    const tenantId = task.tenantId;

    await ActivedNode.findOneAndUpdate(
      { _id: taskId, tenantId },
      { "data.label": label },
      { new: true }
    );

    return { taskId, label };
  }

  async removeAccountable(task) {
    const taskId = task._id;
    const tenantId = task.tenantId;

    await ActivedNode.findOneAndUpdate(
      { _id: taskId, tenantId },
      { "data.accountable": null },
      { new: true }
    );
    return { taskId, accountable: null };
  }
}

module.exports = ActivedTasksRepository;
