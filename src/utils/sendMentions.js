const extractMentions = require('./extractMentions');
const sendToConnectedUsers = require('../websockets/functions/sendToConnectedUsers');
const Notification = require('../models/Notification')
const { DateTime } = require("luxon");
const getNotificationClientFormat = require('./getNotificationClientFormat');

module.exports = async function (chat, ref) {

    const mentionedUsers = extractMentions(chat.message);
    const lenMentions = mentionedUsers.length;

    if (lenMentions) {

        const userList = mentionedUsers.map(item => item = { userId: item.id, read: false })

        const baseModel = {
            ref,
            sendBy: chat.userId,
            content: chat.message, //opcional
            type: chat.type === 'task' ? 'task_mention' : 'flow_mention'
        }

        const liveModel = new Notification({
            readBy: userList,
            sendBy: chat.userId,
            createdAt: DateTime.now(),
            ...baseModel,
        });

        await liveModel.save();
        const clientMentionFormat = await getNotificationClientFormat(liveModel)
        sendToConnectedUsers(mentionedUsers, clientMentionFormat)
    }



}