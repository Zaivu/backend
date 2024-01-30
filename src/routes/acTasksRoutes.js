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
//Estatísticas de usuário
router.get("/activedtasks/user/:id", (req, res, next) =>
  activedTasksController.getUserStats(req, res, next)
);
//Estatísticas geral de usuários
router.get("/activedtasks/users", (req, res, next) =>
  activedTasksController.getTasksByUsers(req, res, next)
);
//Puxar informações de usuários por Tenant
router.get("/activedtasks/tenant", (req, res, next) =>
  activedTasksController.getUsersByTenant(req, res, next)
);
// //Informação de Usuários no módulo da dashboard
// router.get("/activedtasks/dashboard/users", (req, res, next) =>
//   activedTasksController.getDashboardUsersStats(req, res, next)
// );
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
