const Notification = require('../models/Notification')

class NotificationsRepository {
    async create(notificationData) {
        const notification = new Notification(notificationData);
        return await notification.save();
    }

    async findByUser(id) {

        return await Notification.find({ 'readBy.userId': id, 'readBy.read': false }).exec();
    }

    async findById(id) {
        return await Notification.findById(id).exec();
    }

    async updateOne(id, data) {
        return await Notification.findByIdAndUpdate(id, data, { new: true }).exec();
    }


}

module.exports = NotificationsRepository;

