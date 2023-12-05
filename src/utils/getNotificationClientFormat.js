const User = require('../models/User')
const getAvatar = require('../utils/getUserAvatar');
const ActivedFlow = require('../models/ActivedFlow');
const ActivedNode = require('../models/ActivedNode');
const getMomentStatus = require('./getMomentStatus');


module.exports = async function (notification) {

    const { ref, sendBy, content, createdAt, type, _id } = notification;
    const { flowId, taskId } = ref;

    //Em caso de tarefa (opcional)
    let activedTask;
    let moment;


    const project = await ActivedFlow.findById(flowId).exec()

    if (!project)
        return


    if (taskId) {
        activedTask = await ActivedNode.findById(taskId).exec();
        moment = getMomentStatus(activedTask)
    }

    const emitUser = await User.findById(sendBy).exec();
    const avatarURL = await getAvatar(emitUser._id);

    return {
        flow: { title: project.title, flowId: project._id, },
        sendBy: { userId: sendBy, avatarURL, username: emitUser.username },
        ...(activedTask &&
            { task: { taskId: activedTask._id, status: activedTask.data.status, label: activedTask.data.label, moment } }),
        read: false,
        type,
        createdAt,
        content,
        _id,
    }

}




