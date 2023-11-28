const express = require('express');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const requireAuth = require('../middlewares/requireAuth');
const ActivedFlow = mongoose.model('ActivedFlow');
const ActivedNode = mongoose.model('ActivedNode');
const { DateTime } = require('luxon');
const Post = mongoose.model('Post');
const ChatMessage = mongoose.model('ChatMessage');
const exceptions = require('../exceptions');
const router = express.Router();
const checkPermission = require('../middlewares/userPermission');
const getMomentStatus = require('../utils/getMomentStatus');

router.use(requireAuth);



async function getAvatar(userId) {
  let avatar = process.env.DEFAULT_PROFILE_PICTURE;
  const hasPicture = await Post.findOne({ originalId: userId });

  if (hasPicture) {
    avatar = hasPicture.url;
  }

  return avatar;
}
//Paginação
router.get('/pagination/:page', async (req, res) => {
  const { page = '1' } = req.params;
  const user = req.user;

  const tenantId = user.tenantId ? user.tenantId : user._id;
  const rank = user.rank;
  const {
    flowTitle = '',
    label = '',
    client = '',
    alpha = false,
    creation = false,
    status = 'doing', // 'doing' || 'late' || 'pending || done'
    tasksACC = true,
  } = req.query;

  try {
    const today = DateTime.now();

    const isAlpha = alpha === 'true'; //Ordem do alfabeto
    const isCreation = creation === 'true'; //Ordem de Criação
    const isTasksACC = tasksACC === 'true';
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
      sort: { ...SortedBy, _id: 1 }, // ultimas instancias
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

    const query = {
      tenantId,
      flowId: ids,
      type: 'task',
      'data.label': { $regex: label, $options: 'i' },
      'data.status': currentStatus,
    };

    if (currentStatus === 'doing') {
      query['data.expiration.date'] =
        status === 'late'
          ? { $lt: today.toMillis() }
          : { $gt: today.toMillis() };

      if (rank === 'colaborador' || isTasksACC) {
        query['data.accountable.userId'] = user._id;
      }
    } else {
      if (rank === 'colaborador' || isTasksACC) {
        query['data.accountable.userId'] = user._id;
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

//Update task Accountable
router.put('/accountable/', checkPermission, async (req, res) => {
  const { userId, id: taskId } = req.body;

  try {
    const user = await User.findOne({ _id: userId });
    const task = await ActivedNode.findOneAndUpdate(
      { _id: taskId },
      { 'data.accountable': { userId: user._id } },
      { new: true }
    );

    const avatarURL = await getAvatar(user._id);

    res
      .send({
        taskId: task._id,
        accountable: { avatarURL, userId: user._id, username: user.username },
      })
      .status(200);
  } catch (err) {
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});

//Update multiple task Accountable
router.put('/accountable/multiple', checkPermission, async (req, res) => {
  const { userId, tasksList } = req.body;

  try {
    const user = await User.findOne({ _id: userId });

    await Promise.all(
      tasksList.map(async (item) => {
        const task = await ActivedNode.findOneAndUpdate(
          { _id: item.taskId },
          { 'data.accountable': { userId: user._id } },
          { new: true }
        );
        return task;
      })
    );

    const avatarURL = await getAvatar(user._id);

    res.status(200).send({
      list: tasksList,
      accountable: { avatarURL, userId: user._id, username: user.username },
    });
  } catch (err) {
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});

//Update task label
router.put('/label/', async (req, res) => {
  const { label, taskId } = req.body;
  const user = req.user;
  const tenantId = user.tenantId ? user.tenantId : user._id;
  try {

    const task = await ActivedNode.findOneAndUpdate(
      { _id: taskId, tenantId },
      { 'data.label': label },
      { new: true }
    );

    res.status(200).send({ taskId: task._id, label: task.data.label })
  } catch (err) {
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});



//Remove task Accountable
router.delete('/accountable/:id', checkPermission, async (req, res) => {
  const { id: taskId } = req.params;

  try {
    const task = await ActivedNode.findOneAndUpdate(
      { _id: taskId },
      { 'data.accountable': null },

      { new: true }
    );

    res.send({ taskId: task._id, accountable: null }).status(200);
  } catch (err) {
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});

module.exports = router;
