const { getIO, getConnectedUsers } = require("../socket");

module.exports = function (mentionedUsers, userId, msg) {
    const io = getIO();
    const connectedUsers = getConnectedUsers();

    mentionedUsers.forEach((mentionedUser) => {
        const socketId = connectedUsers[mentionedUser.id];
        io.to(socketId).emit('notification', {
            from: userId,
            message: `Você foi mencionado em uma mensagem: ${msg}`
        });
    });
}