const express = require("express");
const router = express.Router();

const checkPermission = require("../middlewares/userPermission");
const requireAuth = require("../middlewares/requireAuth");
const ActivedTasksRepository = require("../repositories/activedTasksRepository");
const ActivedTasksService = require("../services/activedTasksService");
const ActivedTasksController = require("../controllers/activedTasksController");

const activedTasksRepository = new ActivedTasksRepository();
const activedTasksService = new ActivedTasksService(activedTasksRepository);
const activedTasksController = new ActivedTasksController(activedTasksService);

router.use(requireAuth);

//Paginação de Tarefas
router.get("/activedtasks/pagination/:page", (req, res, next) =>
  activedTasksController.pagination(req, res, next)
);

router.get("/activedtasks/user/:userId", (req, res, next) =>
  activedTasksController.getUserStats(req, res, next)
);

//Atualizar Responsável por tarefa
router.put("/activedtasks/accountable/", checkPermission, (req, res, next) =>
  activedTasksController.setAccountable(req, res, next)
);

//Atualizar Responsável por tarefa (múltiplo)
router.put(
  "/activedtasks/accountable/multiple",
  checkPermission,
  (req, res, next) =>
    activedTasksController.setAccountableMultiple(req, res, next)
);
//Atualizar rótulo de tarefa
router.put("/activedtasks/label/", (req, res, next) =>
  activedTasksController.setLabel(req, res, next)
);
// Remover Responsável de tarefa
router.delete(
  "/activedtasks/accountable/:id",
  checkPermission,
  (req, res, next) => activedTasksController.removeAccountable(req, res, next)
);

module.exports = router;
