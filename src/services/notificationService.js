const exceptions = require("../exceptions");

// Validação de dados e lógica de negócios aqui
class NotificationService {
    constructor(notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    async create(notificationData) {
        return await this.notificationRepository.create(notificationData);
    }


    async findByUser(userId) {
        const notifications = await this.notificationRepository.findByUser(userId)
        const notificationsData = await Promise.all(notifications.map(async (notification) =>
            await this.notificationRepository.findNotificationData(notification)
        ))

        return notificationsData;
    }

    async markOneAsRead(notificationId, userId) {

        const notification = await this.notificationRepository.findById(notificationId);

        if (!notification) {
            throw exceptions.entityNotFound('Notification')
        }

        const user = notification.readby.find(user =>
            user.userId.toString() === userId)


        if (!user) {
            throw exceptions.entityNotFound(`userId: ${userId} in Notification(${notificationId})`)
        }

        user.read = true;


        return await this.notificationRepository.update(notificationId, notification)


    }

    async markAllAsRead(notificationIds, userId) {

        for (const id of notificationIds) {

            const notification = await this.notificationRepository.findById(id);

            if (!notification)
                throw exceptions.entityNotFound(`id: ${id} not found on Notification Repository`)

            const user = notification.readBy.find(user => user.userId.toString() === userId);
            if (!user)
                throw exceptions.entityNotFound(`userId: ${userId} in Notification (${id})`)


            user.read = true;

            await this.notificationRepository.update(id, notification)

        }

        return true;


    }
}

module.exports = NotificationService;