const Notification = require('../models/Notification')
const getNotificationClientFormat = require('../utils/getNotificationClientFormat');

class NotificationsRepository {
    //Cria uma notificação de qualquer tipo
    async create(notificationData) {
        const notification = new Notification(notificationData);
        return await notification.save();
    }


    //Procura todas as notificações não lidas por um usuário
    async findByUser(id, type) {

        return await Notification.find({
            'readBy': {
                $elemMatch: {
                    'userId': id.toString(),
                    'read': false
                }
            }, ...(type && { type })
        }).exec();
    }

    //Procura por um notificação por id
    async findById(id) {
        return await Notification.findById(id).exec();
    }


    //Atualiza uma notificação com dados de notificação
    async update(id, data) {
        const notification = await Notification.findByIdAndUpdate(id, data, { new: true }).exec();
        return notification
    }

    //Procura informações que auxiliam na identificação da notificação
    async findNotificationData(data) {
        return await getNotificationClientFormat(data);

    }
}



module.exports = NotificationsRepository;

