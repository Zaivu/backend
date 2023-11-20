const { getIO, getConnectedUsers } = require("../socket");

module.exports = function (mentionedUsers, options, userId) {
    const io = getIO();
    const connectedUsers = getConnectedUsers();

    const { content: msg, refId, type } = options;

    mentionedUsers.forEach((mentionedUser) => {
        const socketId = connectedUsers[mentionedUser.id];
        io.to(socketId).emit('notification', {
            from: userId,
            message: msg,
            refId,
            type,

        });
    });
}