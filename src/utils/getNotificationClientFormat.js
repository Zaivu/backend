const User = require('../models/User')
const getAvatar = require('../utils/getUserAvatar');
const ActivedFlow = require('../models/ActivedFlow');
const ActivedNode = require('../models/ActivedNode');

module.exports = async function (notification) {

    const { ref, sendBy, content, createdAt, type } = notification;
    const { flowId, taskId } = ref;

    let activedTask;
    const project = await ActivedFlow.findById(flowId).exec()

    if (taskId) {
        activedTask = await ActivedNode.findById(taskId).exec()
    }
    const emitUser = await User.findById(sendBy).exec();
    const avatarURL = await getAvatar(emitUser._id);

    return {
        flow: { title: project.title, flowId: project._id, },
        sendBy: { userId: sendBy, avatarURL, username: emitUser.username },
        ...(activedTask && { task: { taskId: activedTask._id, label: activedTask.data.label } }),
        read: false,
        type,
        createdAt,
        content,
    }

}