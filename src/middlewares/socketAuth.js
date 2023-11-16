const jwt = require('jsonwebtoken');
const { config } = require('./config');

function socketAuth(socket, next) {
    const token = socket.handshake.auth.token;
    jwt.verify(token, config.jwtSecret, function (err, decoded) {
        if (err) return next(new Error('Erro de autenticação'));
        socket.decoded = decoded;
        next();
    });
}

module.exports = socketAuth;