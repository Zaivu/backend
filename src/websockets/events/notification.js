module.exports = function (socket) {
    socket.on('notification', () => {
        //console.log({ data })

        // socket.broadcast.emit('receive_notification', data)
        // lógica para lidar com notificações
    });
};