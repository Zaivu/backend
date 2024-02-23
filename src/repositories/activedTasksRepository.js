const User = require("../models/User");
const ActivedNode = require("../models/ActivedNode");
const ActivedFlow = require("../models/ActivedFlow");
const { DateTime } = require("luxon");
const getAvatar = require("../utils/getUserAvatar");
const getTaskData = require("../utils/getTaskData");
const getMomentStatus = require("../utils/getMomentStatus");
const getUserAvatar = require("../utils/getUserAvatar");
const getFlowMomentStatus = require("../utils/getFlowMomentStatus");

class ActivedTasksRepository {
  async pagination(user, queries, page) {
    const {
      flowTitle = "",
      label = "",
      client = "",
      userId = false,
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
    //?
    const isAccId = userId === "null" ? null : userId;
    const { ObjectId } = require("mongodb");

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
      ...(isAccId && { "data.accountable.userId": ObjectId(userId) }),
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
  async getDashboardUsersProductivity(tenantId, startDate) {
    const userQuery = {
      $or: [{ _id: tenantId }, { tenantId }],
    };

    const projectQuery = {
      isDeleted: false,
      tenantId,
      ...(startDate && { $gte: { createdAt: startDate } }),
    };
    const liveProjects = await ActivedFlow.find(projectQuery);

    const idList = liveProjects.map((item) => item._id);
    const tenantUsers = await User.find({
      ...userQuery,
      isDeleted: false,
      status: "active",
    });

    const queryTask = {
      flowId: { $in: idList },
      type: "task",
      isDeleted: false,
      "data.status": { $ne: "outscoped" },
    };

    const usersWithTasks = await Promise.all(
      tenantUsers.map(async (user) => {
        const taskMap = {
          doing: [],
          late: [],
          done: [],
          doneLate: [],
          pending: [],
        };

        user = user.toObject({ getters: true, virtuals: true });
        const avatarURL = await getUserAvatar(user._id);
        (
          await ActivedNode.find({
            ...queryTask,
            "data.accountable.userId": user._id,
          })
        ).forEach((task) => {
          task = task.toObject({ getters: true, virtuals: true });
          const moment = getMomentStatus(task);
          if (moment?.currentStatus === "doing") {
            taskMap.doing.push({ ...task, moment });
          } else if (moment?.currentStatus === "done") {
            taskMap.done.push({ ...task, moment });
          } else if (moment?.currentStatus === "doneLate") {
            taskMap.doneLate.push({ ...task, moment });
          } else if (moment?.currentStatus === "late") {
            taskMap.late.push({ ...task, moment });
          } else {
            taskMap.pending.push(task);
          }
        });

        return {
          _id: user._id,
          username: user.username,
          email: user.email,
          taskMap,
          avatarURL,
        };
      })
    );

    return usersWithTasks;
  }
  async getDashboardTasksProductivity(tenantId, startDate) {
    const projectQuery = {
      isDeleted: false,
      tenantId,
      ...(startDate && { $gte: { createdAt: startDate } }),
    };
    const liveProjects = await ActivedFlow.find(projectQuery);

    const idList = liveProjects.map((item) => item._id);

    const queryTask = {
      flowId: { $in: idList },
      type: "task",
      isDeleted: false,
    };

    const [alreadyStartedTasks, pendingTasks] = await Promise.all([
      ActivedNode.find({
        ...queryTask,
        "data.status": { $in: ["doing", "done"] },
        ...(startDate && { $gte: { "data.startedAt": startDate } }),
      }),
      ActivedNode.find({ ...queryTask, "data.status": "pending" }),
    ]);

    const accountables = await this.getTenantUsersWithAvatars({
      $or: [{ _id: tenantId }, { tenantId }],
    });

    const accountableMap = accountables.reduce((map, user) => {
      map[user._id] = { username: user.username, avatarURL: user.avatarURL };
      return map;
    }, {});

    const augmentedTasks = [...alreadyStartedTasks, ...pendingTasks].map(
      (task) => {
        if (
          task.data?.accountable?.userId &&
          accountableMap[task.data.accountable.userId]
        ) {
          task.data.accountable.username =
            accountableMap[task.data.accountable.userId].username;
          task.data.accountable.avatarURL =
            accountableMap[task.data.accountable.userId].avatarURL;
        }
        return task;
      }
    );

    const taskMap = {
      doing: [],
      late: [],
      done: [],
      doneLate: [],
      pending: [],
      nonAcc: [],
    };

    augmentedTasks.forEach((task) => {
      task = task.toObject({ getters: true, virtuals: true });
      const moment = getMomentStatus(task);

      if (!task.data?.accountable && task.data.status !== "done")
        taskMap.nonAcc.push(task);
      if (moment?.currentStatus === "doing") {
        taskMap.doing.push({ ...task, moment });
      } else if (moment?.currentStatus === "done") {
        taskMap.done.push({ ...task, moment });
      } else if (moment?.currentStatus === "doneLate") {
        taskMap.doneLate.push({ ...task, moment });
      } else if (moment?.currentStatus === "late") {
        taskMap.late.push({ ...task, moment });
      } else {
        taskMap.pending.push(task);
      }
    });

    return taskMap;
  }
  async getDashboardFlowsProductivity(tenantId) {
    const projectQuery = {
      isDeleted: false,
      tenantId,
    };
    const liveProjects = await ActivedFlow.find(projectQuery);
    const flowsMap = {
      done: [],
      doneLate: [],
      doing: [],
      late: [],
    };

    liveProjects.forEach((flow) => {
      const moment = getFlowMomentStatus(flow);

      if (moment.currentStatus === "done") {
        flowsMap.done.push(flow);
      } else if (moment.currentStatus === "doneLate") {
        flowsMap.doneLate.push(flow);
      } else if (moment.currentStatus === "late") {
        flowsMap.late.push(flow);
      } else {
        flowsMap.doing.push(flow);
      }
    });

    return flowsMap;
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
          flowId: item.flowId,
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

  async updateTask(query, data) {
    return await ActivedNode.findOneAndUpdate(query, data, { new: true });
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
