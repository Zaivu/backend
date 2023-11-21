const Notification = require('../models/Notification')

class NotificationsRepository {
    async create(notificationData) {
        const notification = new Notification(notificationData);
        return notification.save();
    }

    async findByUser(id) {


        return Notification.find({ 'readBy.userId': id }).exec();
    }

    // Implemente outros métodos CRUD aqui
}

module.exports = NotificationsRepository;

