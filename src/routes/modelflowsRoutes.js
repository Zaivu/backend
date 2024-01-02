const express = require("express");
const ModelflowsController = require("../controllers/modelflowsController");
const ModelflowsService = require("../services/modelflowsService");
const ModelflowsRepository = require("../repositories/modelflowsRepository");
const requireAuth = require("../middlewares/requireAuth");

const router = express.Router();

const modelflowsRepository = new ModelflowsRepository(); // Conexão com o BD
const modelflowsService = new ModelflowsService(modelflowsRepository);
const modelflowsController = new ModelflowsController(modelflowsService);

router.use(requireAuth);

// Paginação
router.get("/modelflows/pagination/:tenantId/page", (req, res, next) =>
  modelflowsController.pagination(req, res, next)
);

// Listar projetos
router.get("/modelflows/list", (req, res, next) =>
  modelflowsController.list(req, res, next)
);

// Carregar informações de painel
router.get("/modelflows/flow/:flowId", (req, res, next) =>
  modelflowsController.getFlow(req, res, next)
);

// Criar um novo projeto
router.post("/modelflows/new", (req, res, next) =>
  modelflowsController.newProject(req, res, next)
);

// Criar um novo modelo (versionamento)
router.post("/modelflows/new/model", (req, res, next) =>
  modelflowsController.newModel(req, res, next)
);

// Copiar modelo
router.post("/modelflows/copy", (req, res, next) =>
  modelflowsController.copy(req, res, next)
);

//Renomear modelo
router.put("/modelflows/rename", (req, res, next) =>
  modelflowsController.rename(req, res, next)
);

// Editar um modelo
router.put("/modelflows/edit", (req, res, next) =>
  modelflowsController.edit(req, res, next)
);

// Definir modelo como padrão
router.put("/modelflows/default", (req, res, next) =>
  modelflowsController.setDefault(req, res, next)
);

// ? Deleta o Projeto raiz e suas versões permanentemente (se existirem)
router.delete("/modelflows/project/:flowId", (req, res, next) =>
  modelflowsController.deleteProject(req, res, next)
);

//Deletar modelo
router.delete("/modelflows/flow/:flowId", (req, res, next) =>
  modelflowsController.deleteFlow(req, res, next)
);

module.exports = router;
