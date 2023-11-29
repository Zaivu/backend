const exceptions = require("../exceptions");

// Validação de dados e lógica de negócios aqui
class NotificationService {
    constructor(notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    async create(notificationData) {
        return await this.notificationRepository.create(notificationData);
    }


    async findByUser(userId, type) {
        const notifications = await this.notificationRepository.findByUser(userId, type)
        const notificationsData = await Promise.all(notifications.map(async (notification) =>
            await this.notificationRepository.findNotificationData(notification)
        ))

        return notificationsData;
    }

    async markOneAsRead(notificationId, userId) {

        let notification = await this.notificationRepository.findById(notificationId);

        if (!notification) {
            throw exceptions.entityNotFound('Notification')
        }

        notification.readBy = notification.readBy.map(item => {
            if (item.userId.toString() === userId.toString()) {
                item.read = true;
            }
            return item;
        })

        const data = notification;
        const id = notification._id;

        const updatedNotification = await this.notificationRepository.update(id, data)

        return updatedNotification;


    }

    async markAllAsRead(userId, type) {

        const notifications = await this.notificationRepository.findByUser(userId, type)

        for (let notification of notifications) {
            notification.readBy = notification.readBy.map(item => {
                if (item.userId.toString() === userId.toString()) {
                    item.read = true;
                }
                return item;
            })

            const data = notification;
            const id = notification._id;

            await this.notificationRepository.update(id, data)

        }




        return notifications

    }
}

module.exports = NotificationService;