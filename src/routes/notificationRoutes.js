const express = require('express');
const NotificationController = require('../controllers/notificationController');
const NotificationService = require('../services/notificationService');
const NotificationRepository = require('../repositories/notificationRepository');
const requireAuth = require('../middlewares/requireAuth');

const router = express.Router();

const notificationRepository = new NotificationRepository();    //Conexão com o BD
const notificationService = new NotificationService(notificationRepository); // 
const notificationController = new NotificationController(notificationService);

router.use(requireAuth);

router.post('/notifications', (req, res, next) => notificationController.create(req, res, next));
router.get('/notifications', (req, res, next) => notificationController.findByUser(req, res, next))
router.put('/notifications/:notificationId/read/:userId', (req, res, next) => notificationController.markOneAsRead(req, res, next));
router.put('/notifications/read', (req, res, next) => notificationController.markAllAsRead(req, res, next));

module.exports = router;