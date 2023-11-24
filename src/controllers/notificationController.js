
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


            const notifications = await this.notificationService.findByUser(userId)
            res.status(200).send(notifications);

        }
        catch (error) {
            console.log(error)

            const code = error.code ? error.code : "412";
            res.status(code).send({ error: error.message, code });

        }
    }

    async markOneAsRead(req, res) {
        const { notificationId, userId } = req.body;
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

            const { notificationIds, userId } = req.body;

            // P/ notificationIds = [...{id}]  

            await this.notificationService.markAllAsRead(notificationIds, userId);

            res.status(20).send({ message: 'Todas as notificações marcadas como lidas' });
        } catch (error) {
            const code = error.code ? error.code : "412";
            res.status(code).send({ error: error.message, code });
        }

    }

}

module.exports = NotificationController;