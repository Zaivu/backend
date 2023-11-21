
//Controllers

class NotificationController {
    constructor(notificationService) {
        this.notificationService = notificationService;
    }

    async create(req, res) {
        //const { } = req.body;
        try {
            const notification = await this.notificationService.create(req.body);
            res.status(201).send(notification);
        } catch (error) {
            const code = error.code ? error.code : "412";
            res.status(code).send({ error: error.message, code });
        }
    }

    async findByUser(req, res) {
        const { userId } = req.params;

        try {

            const notifications = await this.notificationService.findByUser(userId)
            res.status(200).send(notifications);

        }
        catch (error) {
            const code = error.code ? error.code : "412";
            res.status(code).send({ error: error.message, code });

        }
    }

    // Adicione outros métodos conforme necessário
}

module.exports = NotificationController;