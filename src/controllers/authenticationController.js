const exceptions = require("../exceptions/index.js");
class AuthenticationController {
  constructor(authenticationService) {
    this.authenticationService = authenticationService;
  }

  async verifyToken(_, res) {
    try {
      const result = await this.authenticationService.verifyToken();
      res.status(200).send(result);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }
  async validateToken(req, res) {
    try {
      const { token } = req.params;

      const result = await this.authenticationService.validateToken(token);
      res.status(200).send(result);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }
  async signIn(req, res) {
    try {
      const { login: email, password } = req.body;

      if (!email || !password) {
        exceptions.unprocessableEntity("É necessário fornecer email e senha");
      }

      const result = await this.authenticationService.signIn(email, password);
      res.status(200).send(result);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }
  async signUp(req, res) {
    try {
      const { email, username, password } = req.body;

      const result = await this.authenticationService.signUp(
        email,
        password,
        username
      );
      res.status(201).send(result);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }
  async createUserAdmin(req, res) {
    try {
      const { username, password, email, enterpriseName = "" } = req.body;

      const result = await this.authenticationService.createUserAdmin(
        email,
        password,
        username,
        enterpriseName
      );
      res.status(201).send(result);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }
  async createUserColab(req, res) {
    try {
      const {
        username,
        tenantId,
        rank = "gerente",
        password,
        email,
      } = req.body;

      const result = await this.authenticationService.createUserColab(
        tenantId,
        email,
        password,
        username,
        rank
      );
      res.status(201).send(result);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }
  async newToken(req, res) {
    try {
      const { refreshToken, userId } = req.body;

      const result = await this.authenticationService.newToken(
        userId,
        refreshToken
      );
      res.status(200).send(result);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }
  async resetPassword(req, res) {
    try {
      const { email } = req.body;
      const result = await this.authenticationService.resetPassword(email);
      res.status(200).send(result);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }
  async newPassword(req, res) {
    try {
      const { password, resetToken } = req.body;

      const result = await this.authenticationService.newPassword(
        password,
        resetToken
      );
      res.status(200).send(result);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }
  async editPassword(req, res) {
    try {
      const { oldPass, newPass, id } = req.body;
      const result = await this.authenticationService.editPassword(
        id,
        oldPass,
        newPass
      );
      res.status(200).send(result);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }
  async editUsername(req, res) {
    try {
      const { id, username } = req.body;

      const result = await this.authenticationService.editUsername(
        id,
        username
      );

      res.status(200).send(result);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }

  async editEnterpriseName(req, res) {
    try {
      const { id, enterpriseName } = req.body;

      const result = await this.authenticationService.editEnterpriseName(
        id,
        enterpriseName
      );
      res.status(200).send(result);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }
}

module.exports = AuthenticationController;
