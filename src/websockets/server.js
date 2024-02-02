const { createServer } = require("http");
const { createServer: createServerHTTPS } = require("https");
const { init, addUser, getConnectedUsers } = require("./socket");
const socketAuth = require("../middlewares/socketAuth");
const handleNotificationEvent = require("./events/notification");
const handleDisconnectEvent = require("./events/disconnect");

module.exports = function (certObject, app) {
  const httpServer = createServer(app);
  const httpsServer = createServerHTTPS(certObject, app);
  const io = init(httpServer);
  const WSSio = init(httpsServer);

  io.use(socketAuth);
  io.on("connection", (socket) => {
    const { userId } = socket.decoded;
    addUser(userId, socket.id);
    handleNotificationEvent(socket);
    handleDisconnectEvent(socket, userId);
    console.log("connected Users on WS: ", getConnectedUsers());
  });

  WSSio.use(socketAuth);
  WSSio.on("connection", (socket) => {
    const { userId } = socket.decoded;
    addUser(userId, socket.id);
    handleNotificationEvent(socket);
    handleDisconnectEvent(socket, userId);
    console.log("connected Users on WSS: ", getConnectedUsers());
  });

  return { httpServer, httpsServer };
};
