const { removeUser } = require("../socket");

module.exports = function (socket, userId) {
    socket.on('disconnect', () => {
        removeUser(userId)

    });
};