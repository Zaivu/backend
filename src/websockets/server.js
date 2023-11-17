
const { createServer } = require("http");
const { init, addUser, getConnectedUsers } = require("./socket");
const socketAuth = require("../middlewares/socketAuth");
const handleNotificationEvent = require('./events/notification');
const handleDisconnectEvent = require('./events/disconnect');

module.exports = function (app) {
    const httpServer = createServer(app);
    const io = init(httpServer)

    io.use(socketAuth)
    io.on("connection", (socket) => {
        const { userId } = socket.decoded;
        addUser(userId, socket.id)
        handleNotificationEvent(socket);
        handleDisconnectEvent(socket, userId);
        console.log('connected Users: ', getConnectedUsers())
    });

    return httpServer
};
