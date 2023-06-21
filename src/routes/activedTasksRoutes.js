const express = require('express');
const moment = require('moment');
const mongoose = require('mongoose');
const requireAuth = require('../middlewares/requireAuth');
const ActivedFlow = mongoose.model('ActivedFlow');
const ActivedNode = mongoose.model('ActivedNode');
const { DateTime } = require('luxon');
const Post = mongoose.model('Post');
const ChatMessage = mongoose.model('ChatMessage');
const exceptions = require('../exceptions');
const router = express.Router();

router.use(requireAuth);

function getMomentStatus(startedAt, expirationHours, status, date) {
  //date é a data de comparação, pode ser hoje ou a data de conclusão
  //da tarefa

  let compareDate = date;

  if (status === 'done') {
    compareDate = DateTime.fromMillis(date);
  }

  const start = DateTime.fromMillis(startedAt);

  const deadlineDate = start.plus({ hours: expirationHours });

  const diffHours = deadlineDate.diff(compareDate, 'hours').hours;
  const diffDays = deadlineDate.diff(compareDate, 'days').days;

  //Calculo básico -> startedAt + expirationTime = data final  -> milissegundos

  const currentStatus =
    status === 'doing'
      ? diffHours > 0
        ? 'doing'
        : 'late'
      : status === 'done'
      ? diffHours > 0
        ? 'done'
        : 'doneLate'
      : null;

  return {
    currentStatus,
    diffHours,
    diffDays,
    deadline: status === 'doing' ? deadlineDate.toMillis() : null,
    finishedAt: status === 'done' ? date : null,
  };
}
//Paginação
router.get('/pagination/:page', async (req, res) => {
  const { page = '1' } = req.params;
  const user = req.user;
  const tenantId = user.tenantId ? user.tenantId : user._id;
  const {
    flowTitle = '',
    label = '',
    client = '',
    alpha = false,
    creation = false,
    status = 'doing', // 'doing' || 'late' || 'pending || done'
  } = req.query;

  try {
    const today = DateTime.now();

    const isAlpha = alpha === 'true'; //Ordem do alfabeto
    const isCreation = creation === 'true'; //Ordem de Criação
    const isStatusException =
      status === 'doing' ||
      status === 'late' ||
      status === 'pending' ||
      status === 'done'
        ? false
        : true;

    if (isStatusException) {
      throw exceptions.unprocessableEntity('invalid query status');
    }

    const SortedBy = isCreation
      ? { 'data.startedAt': 1 }
      : isAlpha
      ? { 'data.label': 1 }
      : { 'data.startedAt': -1 };

    const paginateOptions = {
      page,
      limit: 10,
      sort: SortedBy, // ultimas instancias
    };

    const allProjects = await ActivedFlow.find({
      isDeleted: false,
      client: { $regex: client, $options: 'i' },
      title: { $regex: flowTitle, $options: 'i' },
    });

    const projects = allProjects.map(
      (item) => (item = { title: item.title, flowId: item._id })
    );

    const ids = projects.map((item) => item.flowId);

    const currentStatus =
      status === 'late' || status === 'doing' ? 'doing' : status;

    const Pagination = await ActivedNode.paginate(
      currentStatus === 'doing'
        ? {
            tenantId,
            flowId: ids,
            type: 'task',
            'data.label': { $regex: label, $options: 'i' },
            'data.status': currentStatus,
            'data.expiration.date':
              status === 'late'
                ? { $lt: today.toMillis() }
                : { $gt: today.toMillis() },
          }
        : {
            tenantId,
            flowId: ids,
            type: 'task',
            'data.label': { $regex: label, $options: 'i' },
            'data.status': currentStatus,
          },

      paginateOptions
    );

    // console.log("***********************************")
    // console.log({ queries: req.query })
    // console.log({ tasks: Pagination.docs.map(item => item = { label: item.data.label, flowId: item.flowId }) })

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

          const startedAt = item.data.startedAt;
          const hoursUntilExpiration = item.data.expiration.number;

          const taskStatus = item.data.status;
          const moment =
            taskStatus === 'doing'
              ? getMomentStatus(
                  startedAt,
                  hoursUntilExpiration,
                  taskStatus,
                  today
                )
              : taskStatus === 'done'
              ? getMomentStatus(
                  startedAt,
                  hoursUntilExpiration,
                  taskStatus,
                  item.data.finishedAt
                )
              : null;

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
          };

          return task;
        }
      })
    );

    const totalPages = Pagination.totalPages;

    const response = {
      pagination: taskPagination,
      totalPages,
      today,
    };

    res.send(response).status(200);
  } catch (err) {
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});

router.get(
  '/actived-tasks/stats/:employeer/:startDate/:endDate',
  async (req, res) => {
    const { employeer, startDate, endDate } = req.params;

    //try {
    const nowLocal = moment().utcOffset(-180);

    const startDateFormat = moment(startDate).unix() * 1000;
    const endDateFormat = moment(endDate).unix() * 1000;

    const tasksDone = await ActivedNode.find({
      'data.accountable': employeer,
      type: 'task',
      'data.status': 'done',
      'data.finishedAt': {
        $gte: startDateFormat,
        $lte: endDateFormat,
      },
    });
    const tasksDoing = await ActivedNode.find({
      'data.accountable': employeer,
      type: 'task',
      'data.status': 'doing',
    });

    let doneHours = 0;
    let doingHours = 0;
    let producReal = 0;
    let producIdeal = 0;

    tasksDone.forEach((el) => {
      doneHours += el.data?.expiration?.number;

      producReal += moment(el.data.finishedAt).diff(
        moment(el.data.startedAt),
        'hours',
        true
      );
      producIdeal += el.data?.expiration?.number;
    });

    tasksDoing.forEach((el) => (doingHours += el.data?.expiration?.number));

    const hours = { doneHours, doingHours };
    const productivity = (producIdeal / producReal) * 100;

    const doingTasks = tasksDoing.filter(
      (el) =>
        moment(el.data.startedAt)
          .add(el.data.expiration.number, 'hours')
          .diff(nowLocal, 'hours', true) >= 0
    ).length;

    const expiredTasks = tasksDoing.filter(
      (el) =>
        moment(el.data.startedAt)
          .add(el.data.expiration.number, 'hours')
          .diff(nowLocal, 'hours', true) < 0
    ).length;

    const doneTasks = tasksDone.filter((el) => !el.data.expired).length;

    const expiredDoneTasks = tasksDone.filter(
      (el) => el.data.expired === true
    ).length;

    res.send({
      hours,
      productivity,
      stats: { doingTasks, expiredTasks, doneTasks, expiredDoneTasks },
    });
    // } catch (err) {
    //   res.status(422).send({ error: err.message });
    // }
  }
);

module.exports = router;
