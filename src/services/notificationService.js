// Validação e lógica de negócios aqui
class NotificationService {
    constructor(notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    async create(notificationData) {

        return this.notificationRepository.create(notificationData);
    }


    async findByUser(userId) {
        return this.notificationRepository.findByUser(userId)
    }


}

module.exports = NotificationService;