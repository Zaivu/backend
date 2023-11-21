const extractMentions = require('../utils/extractMentions');
const sendToConnectedUsers = require('../websockets/functions/sendToConnectedUsers');
const Notification = require('../models/Notification')
const { DateTime } = require("luxon");

module.exports = async function (next) {

    const mentionedUsers = extractMentions(this.message);
    const lenMentions = mentionedUsers.length;


    if (lenMentions) {

        const userList = mentionedUsers.map(item => item = { userId: item.id, read: false })

        const baseModel = {
            sendBy: this.userId,
            refId: this.refId,
            content: this.message, //opcional
            type: this.type === 'task' ? 'task_mention' : 'flow_mention'
        }

        const liveModel = new Notification({
            readBy: userList,
            sendBy: this.userId,
            createdAt: DateTime.now(),
            ...baseModel,
        });

        await liveModel.save();
        sendToConnectedUsers(mentionedUsers, liveModel, this.userId)
    }

    next();

}