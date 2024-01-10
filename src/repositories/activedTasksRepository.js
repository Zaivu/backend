const User = require("../models/User");
const ActivedNode = require("../models/ActivedNode");
const ActivedFlow = require("../models/ActivedFlow");
const { DateTime } = require("luxon");
const getAvatar = require("../utils/getUserAvatar");
const getTaskData = require("../utils/getTaskData");
const getMomentStatus = require("../utils/getMomentStatus");

class ActivedTasksRepository {
  async pagination(user, queries, page) {
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

    const nowLocal = DateTime.now();

    const tenantId = user.tenantId ? user.tenantId : user._id;
    const rank = user.rank;
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
          ? { $lt: nowLocal.toMillis() }
          : { $gt: nowLocal.toMillis() };

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
        const currentProject = projects.find(
          (p) => JSON.stringify(item.flowId) === JSON.stringify(p.flowId)
        );
        if (currentProject) {
          const task = await getTaskData(item);
          return { ...task, projectName: currentProject.title };
        }
      })
    );

    const totalPages = Pagination.totalPages;

    return { pagination: taskPagination, totalPages, today: nowLocal };
  }
  async getUserStats(user, dates) {
    const { initial, final } = dates;
    const userId = user._id;
    const tenantId = user.tenantId ? user.tenantId : user._id;

    let dataInicial = DateTime.fromISO(initial).toMillis(); // 10 de Agosto de 2023
    let dataFinal = DateTime.fromISO(final).toMillis();

    const filters = {
      isDeleted: false,
      tenantId,
      type: "task",
      "data.accountable.userId": userId,
      "data.startedAt": {
        $gte: dataInicial,
        $lte: dataFinal,
      },
    };

    const projects = await ActivedFlow.find({ isDeleted: false, tenantId });

    //Remap de Projetos
    const projectsMap = projects.reduce((map, project) => {
      map[project._id] = project;
      return map;
    }, {});

    //Remap de Tarefas
    const taskRemap = (item) => {
      item = item.toObject({ getters: true, virtuals: true });
      return {
        _id: item._id,
        label: item.data.label,
        status: item.data.status,
        moment: getMomentStatus(item),
        startedAt: item.data.startedAt ? item.data.startedAt : null,
        finishedAt: item.data.finishedAt ? item.data.finishedAt : null,
        expiration: item.data.expiration,
        projectInfo: {
          title: projectsMap[item.flowId]?.title,
          createdAt: projectsMap[item.flowId]?.createdAt,
          finishedAt: projectsMap[item.flowId]?.finishedAt
            ? projectsMap[item.flowId]?.finishedAt
            : null,
        },
      };
    };

    const doing = (
      await ActivedNode.find({ ...filters, "data.status": "doing" })
    ).map(taskRemap);

    const done = (
      await ActivedNode.find({
        ...filters,
        "data.status": "done",
      })
    ).map(taskRemap);

    return { doing, done };
  }
  async getTenantUsersWithAvatars(query) {
    const users = await User.find(query);

    return await Promise.all(
      users.map(async (user) => {
        const avatarURL = await getAvatar(user._id);
        const plainUser = user.toObject({
          getters: true,
          virtuals: true,
        });
        return { ...plainUser, avatarURL };
      })
    );
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
