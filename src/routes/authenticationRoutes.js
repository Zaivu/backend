const express = require("express");
const router = express.Router();
const requireAuth = require("../middlewares/requireAuth");
const AuthenticationRepository = require("../repositories/authenticationRepository");
const AuthenticationService = require("../services/authenticationService");
const AuthenticationController = require("../controllers/authenticationController");

const authenticationRepository = new AuthenticationRepository();
const authenticationService = new AuthenticationService(
  authenticationRepository
);
const authenticationController = new AuthenticationController(
  authenticationService
);
// Verificar Token JWT
router.get("/auth/verify-token", requireAuth, async (req, res, next) =>
  authenticationController.verifyToken(req, res, next)
);
// Validar Token JWT
router.get("/auth/validate-token/:token", async (req, res, next) =>
  authenticationController.validateToken(req, res, next)
);
// Fazer Login
router.post("/auth/sign-in", async (req, res, next) =>
  authenticationController.signIn(req, res, next)
);
// Validar Conta
router.post("/auth/sign-up", async (req, res, next) =>
  authenticationController.signUp(req, res, next)
);
// Criar conta administrador
router.post("/auth/create-user/admin", async (req, res, next) =>
  authenticationController.createUserAdmin(req, res, next)
);
//Criar conta Colaborador/Gerente
router.post("/auth/create-user/colab", async (req, res, next) =>
  authenticationController.createUserColab(req, res, next)
);
//Gerar um novo token
router.post("/auth/new-token", async (req, res, next) =>
  authenticationController.newToken(req, res, next)
);
//Esqueci minha senha
router.put("/auth/reset-password-email", async (req, res, next) =>
  authenticationController.resetPassword(req, res, next)
);
router.put("/auth/new-password", async (req, res, next) =>
  authenticationController.newPassword(req, res, next)
);
//Editar Senha
router.put("/auth/edit-password", async (req, res, next) =>
  authenticationController.editPassword(req, res, next)
);
//Editar Username
router.put("/auth/edit-username", async (req, res, next) =>
  authenticationController.editUsername(req, res, next)
);
//Editar nome da Empresa
router.put("/auth/edit-enterprise-name", async (req, res, next) =>
  authenticationController.editEnterpriseName(req, res, next)
);

module.exports = router;
