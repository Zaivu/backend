const { Server } = require("socket.io");
let io;
let connectedUsers = {}

module.exports = {
    init: (httpServer) => {
        io = new Server(httpServer, {
            cors: {
                origin: process.env.APP_URL,
                methods: ['GET', "POST"]
            }
        });
        return io;
    },
    getIO: () => {
        if (!io) {
            throw new Error("Socket.io not initialized!");
        }
        return io;
    },
    getConnectedUsers: () => {
        return connectedUsers;

    },
    addUser: (userId, socketId) => {
        connectedUsers[userId] = socketId;
    },
    removeUser: (userId) => {
        delete connectedUsers[userId];
    }

};