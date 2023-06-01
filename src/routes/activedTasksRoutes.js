const express = require('express');
const moment = require('moment');
const mongoose = require('mongoose');
const requireAuth = require('../middlewares/requireAuth');
const ActivedFlow = mongoose.model('ActivedFlow');
const ActivedNode = mongoose.model('ActivedNode');
const { DateTime } = require('luxon');
const Post = mongoose.model('Post');
const ChatMessage = mongoose.model('ChatMessage');

const router = express.Router();

router.use(requireAuth);

function getMomentStatus(startedAt, expirationHours, status, date) {
  //date é a data de comparação, pode ser hoje ou a data de conclusão
  //da tarefa

  let compareDate = date;

  if (status === 'done') {
    compareDate = DateTime.fromMillis(date).setLocale('Pt-BR');
  }

  let start = DateTime.fromJSDate(startedAt).setLocale('Pt-BR');

  //! Algumas Datas estão no formato numérico de milissegundos
  const isInvalid = !start.isValid;
  if (isInvalid) {
    start = DateTime.fromMillis(startedAt).setLocale('Pt-BR');
  }

  const deadlineDate = start.plus({ hours: expirationHours });

  const diffHours = deadlineDate.diff(compareDate, 'hours').hours;
  const diffDays = deadlineDate.diff(compareDate, 'days').days;

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
  };
}
//Paginação
router.get('/pagination/:page', async (req, res) => {
  const { page = '1' } = req.params;
  const { _id: tenantId } = req.user;
  const {
    label = '',
    client = '',
    alpha = false,
    creation = false,
    status = 'doing',
  } = req.query;

  try {
    const today = DateTime.now();

    const isAlpha = alpha === 'true'; //Ordem do alfabeto
    const isCreation = creation === 'true'; //Ordem de Criação

    const SortedBy = isCreation
      ? { createdAt: 1 }
      : isAlpha
      ? { label: 1 }
      : { createdAt: -1 };

    const paginateOptions = {
      page,
      limit: 20,
      sort: SortedBy, // ultimas instancias
    };

    const allProjects = await ActivedFlow.find({
      isDeleted: false,
      client: { $regex: client, $options: 'i' },
    });

    const projects = allProjects.map(
      (item) => (item = { title: item.title, flowId: item._id })
    );

    let ProjectBy = {};

    const Pagination = await ActivedNode.paginate(
      {
        tenantId,
        type: 'task',
        'data.label': { $regex: label, $options: 'i' },

        'data.status': status,
      },

      paginateOptions
    );

    await Promise.all(
      Pagination.docs.map(async (item) => {
        const files = await Post.find({ originalId: item._id });
        const chatMessages = await ChatMessage.find({ refId: item._id });

        const currentProject = projects.find((p) => {
          const comparison =
            JSON.stringify(item.flowId) === JSON.stringify(p.flowId);

          if (comparison) {
            return p;
          }
        });

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
          moment: moment,
          flowId: item.flowId,
          files: files.length,
          chatMessages: chatMessages.length,
        };

        //console.log({ currentProject, label: item.data.label });

        if (currentProject) {
          const index = currentProject.title;

          if (index in ProjectBy) {
            const valueExists = ProjectBy[index].some(
              (obj) => obj.flowId === item.flowId
            );

            if (!valueExists) {
              ProjectBy[index] = [...ProjectBy[index], task];
            }
          } else {
            ProjectBy[index] = [task];
          }
        }

        return task;
      })
    );

    const totalPages = Pagination.totalPages;

    const response = {
      ProjectBy,
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
  '/actived-tasks/search/:tenantId/:title/:page/:flowTitle/:client/:status/:flowType/:employeer',
  async (req, res) => {
    const {
      tenantId,
      page,
      title,
      client,
      flowTitle,
      status,
      flowType,
      employeer,
    } = req.params;
    try {
      //Fetching Flows
      const flows = await ActivedFlow.find(
        {
          tenantId,
          title: {
            $regex: flowTitle === 'undefined' ? RegExp('.*') : flowTitle,
            $options: 'i',
          },
          client: {
            $regex: client === 'undefined' ? RegExp('.*') : client,
            $options: 'i',
          },
          status:
            flowType === 'undefined'
              ? { $exists: true }
              : flowType === 'actived'
              ? { $ne: ['finished'] }
              : ['finished'],
        },
        { lastState: 0, comments: 0 }
      );

      const idArray = flows.map((item) => item._id);

      if (status === 'expired') {
        const nowLocal = moment().utcOffset(-180); // a data de agora

        const nodes = await ActivedNode.find({
          tenantId,
          'data.status':
            status === 'undefined'
              ? { $exists: true }
              : status === 'expired'
              ? 'doing'
              : status === 'doneExpired'
              ? 'done'
              : status,
          'data.label': {
            $regex: title === 'undefined' ? RegExp('.*') : title,
            $options: 'i',
          },
          'data.expired':
            status === 'doneExpired'
              ? true
              : { $ne: true } || { $exists: false },
          'data.accountable':
            employeer === 'undefined' ? { $exists: true } : employeer,
          flowId: { $in: idArray },
        });
        let newNodes = [];

        //Calcular quando uma tarefa ta atrasada
        nodes.forEach((e) => {
          if (
            e.data.status === 'doing' &&
            moment(e.data.startedAt)
              .add(e.data.expiration.number, 'hours')
              .diff(nowLocal, 'hours', true) < 0
          ) {
            newNodes.push(e);
          }
        });

        const tasks = [];
        const number_of_pages = newNodes.length;

        newNodes.forEach((item, index) => {
          if (index >= (page - 1) * 5 && index < page * 5) {
            let newItem = JSON.parse(JSON.stringify(item));
            let newFlow = flows.find(
              (it) => it._id.toString() === item.flowId.toString()
            );

            if (newFlow.status[0] === 'finished') {
              newItem.data.client = newFlow.client;
              newItem.data.flowTitle = newFlow.title;
              newItem.data.flowType = 'finished';
            } else {
              newItem.data.client = newFlow.client;
              newItem.data.flowTitle = newFlow.title;
              newItem.data.flowType = 'actived';
            }

            tasks.push(newItem);
          }
        });

        res.send({ tasks: tasks, pages: number_of_pages });
      } else {
        const number_of_pages = Math.ceil(
          (await ActivedNode.count({
            tenantId,
            'data.status':
              status === 'undefined'
                ? { $exists: true }
                : status === 'expired'
                ? 'doing'
                : status === 'doneExpired'
                ? 'done'
                : status,
            'data.label': {
              $regex: title === 'undefined' ? RegExp('.*') : title,
              $options: 'i',
            },
            'data.expired':
              status === 'doneExpired'
                ? true
                : { $ne: true } || { $exists: false },
            'data.accountable':
              employeer === 'undefined' ? { $exists: true } : employeer,
            flowId: { $in: idArray },
          })) / 5
        );

        const nodes = await ActivedNode.find({
          tenantId,
          'data.status':
            status === 'undefined'
              ? { $exists: true }
              : status === 'expired'
              ? 'doing'
              : status === 'doneExpired'
              ? 'done'
              : status,
          'data.label': {
            $regex: title === 'undefined' ? RegExp('.*') : title,
            $options: 'i',
          },
          'data.expired':
            status === 'doneExpired'
              ? true
              : { $ne: true } || { $exists: false },
          'data.accountable':
            employeer === 'undefined' ? { $exists: true } : employeer,
          flowId: { $in: idArray },
        })
          .skip(5 * (page - 1))
          .limit(5);

        const tasks = nodes.map((item) => {
          let newItem = JSON.parse(JSON.stringify(item));
          let newFlow = flows.find(
            (it) => it._id.toString() === item.flowId.toString()
          );

          if (newFlow.status[0] === 'finished') {
            newItem.data.client = newFlow.client;
            newItem.data.flowTitle = newFlow.title;
            newItem.data.flowType = 'finished';
          } else {
            newItem.data.client = newFlow.client;
            newItem.data.flowTitle = newFlow.title;
            newItem.data.flowType = 'actived';
          }

          return newItem;
        });

        res.send({ tasks: tasks, pages: number_of_pages });
      }
    } catch (err) {
      res.status(422).send({ error: err.message });
    }
  }
);

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
