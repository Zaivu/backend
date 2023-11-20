const { removeUser } = require("../socket");

module.exports = function (socket, userId) {
    socket.on('disconnect', () => {
        console.log({ 'disconnected user': userId })
        removeUser(userId)

    });
};