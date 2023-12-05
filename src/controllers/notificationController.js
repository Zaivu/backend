
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
        try {
            const { _id: userId } = req.user;
            const { type } = req.query;

            const notifications = await this.notificationService.findByUser(userId, type)
            res.status(200).send(notifications);

        }
        catch (error) {
            console.log(error)

            const code = error.code ? error.code : "412";
            res.status(code).send({ error: error.message, code });

        }
    }

    async markOneAsRead(req, res) {
        const { notificationId } = req.param;
        const { _id: userId } = req.user;
        try {

            const notification = await this.notificationService.markOneAsRead(notificationId, userId);

            res.status(201).send(notification);
        } catch (error) {
            const code = error.code ? error.code : "412";
            res.status(code).send({ error: error.message, code });
        }

    }
    async markAllAsRead(req, res) {
        try {
            const { _id: userId } = req.user;
            const { type } = req.body;

            const response = await this.notificationService.markAllAsRead(userId, type);

            res.status(200).send({
                message: 'Todas as notificações foram marcadas como lidas',
                data: response
            });
        } catch (error) {
            console.log(error)
            const code = error.code ? error.code : "412";
            res.status(code).send({ error: error.message, code });
        }

    }

}

module.exports = NotificationController;