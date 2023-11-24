const { getIO, getConnectedUsers } = require("../socket");

module.exports = function (mentionedUsers, options) {
    const io = getIO();
    const connectedUsers = getConnectedUsers();

    mentionedUsers.forEach((mentionedUser) => {
        const socketId = connectedUsers[mentionedUser.id];
        io.to(socketId).emit('notification', options);
    });
}