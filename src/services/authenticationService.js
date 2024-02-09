const exceptions = require("../exceptions");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

class AuthenticationService {
  constructor(authenticationRepository) {
    this.authenticationRepository = authenticationRepository;
  }
  async verifyToken() {
    return await this.authenticationRepository.verifyToken();
  }
  async validateToken(token) {
    const query = { resetToken: token };

    //userService
    const user = await this.authenticationRepository.getUser(query);

    if (!user) {
      throw exceptions.entityNotFound("Usuário não encontrado");
    }

    const enterpriseUser = await this.authenticationRepository.getUser({
      _id: user.tenantId,
    });

    if (!enterpriseUser) {
      throw exceptions.entityNotFound("EnterpriseUser não encontrado");
    }

    return {
      email: user.email,
      username: user.username,
      enterpriseName: user.enterpriseName,
    };
  }
  async signIn(email, password) {
    const query = { isDeleted: false, email };

    //userService
    const user = await this.authenticationRepository.getUser(query);
    if (!user || !(await user.comparePassword(password))) {
      throw exceptions.entityNotFound("Email ou Senha incorretos");
    }

    const { token, refreshToken } = await this.authenticationRepository.signJWT(
      user
    );
    //userService
    const avatarURL = await this.authenticationRepository.getAvatar(user._id);

    const data = {
      token,
      refreshToken,
      user: {
        username: user.username,
        _id: user._id,
        email: user.email,
        rank: user.rank,
        avatarURL,
      },
    };

    return data;
  }
  async signUp(email, password, username) {
    //userService
    const user = await this.authenticationRepository.getUser({
      isDeleted: false,
      email,
    });

    if (!user) {
      throw exceptions.entityNotFound("Usuário não encontrado");
    }

    const salt = await bcrypt.genSalt(10);
    const newPass = await bcrypt.hash(password, salt);

    const userData = {
      password: newPass,
      username,
      status: "active",
      expireToken: null,
      resetToken: null,
    };
    //Trocar para userService
    return await this.authenticationRepository.updateUser(user._id, userData);
  }
  async createUserAdmin(email, password, username, enterpriseName) {
    //userService
    const userExists = await this.authenticationRepository.getUser({
      email,
      isDeleted: false,
    });

    if (userExists) {
      throw exceptions.alreadyExists("Usuário já existe");
    }

    const salt = await bcrypt.genSalt(10);
    const newPass = await bcrypt.hash(password, salt);

    const userData = {
      email,
      password: newPass,
      username,
      rank: "admin",
      status: "active",
      enterpriseName,
    };
    //userService
    const user = await this.authenticationRepository.createUser(userData);

    return {
      _id: user._id,
      username: user.username,
      email: user.email,
      rank: user.rank,
      status: user.status,
      enterpriseName,
    };
  }
  async createUserColab(tenantId, email, password, username, rank) {
    const tenantUser = await this.authenticationRepository.getUser({
      isDeleted: false,
      _id: tenantId,
    });

    if (!tenantUser) {
      throw exceptions.entityNotFound("Usuário não encontrado");
    }

    const salt = await bcrypt.genSalt(10);
    const newPass = await bcrypt.hash(password, salt);

    const userData = {
      username,
      email,
      enterpriseName: tenantUser.enterpriseName,
      rank,
      password: newPass,
      tenantId: tenantUser._id,
    };

    const user = await this.authenticationRepository.createUser(userData);

    return {
      _id: user._id,
      username: user.username,
      email: user.email,
      rank: user.rank,
      status: user.status,
      enterpriseName: tenantUser.enterpriseName,
    };
  }
  async newToken(userId, refreshToken) {
    return await this.authenticationRepository.newToken(userId, refreshToken);
  }
  async resetPassword(email) {
    //userService
    const user = await this.authenticationRepository.getUser({
      email,
      isDeleted: false,
    });

    if (!user) {
      throw exceptions.entityNotFound("Usuário não existe");
    }

    const buffer = crypto.randomBytes(32);
    const token = buffer.toString("hex");

    const data = {
      resetToken: token,
      expireToken: Date.now() + 360000,
    };

    //userService
    await this.authenticationRepository.updateUser(user._id, data);

    const emailContent = {
      subject: "Redefinir senha",
      body: `Para redefinir sua senha (irá expirar em uma hora o link): <a href="${process.env.APP_URL}/resetpassword/${token}">Clique aqui</a>`,
    };

    return await this.authenticationRepository.sendEmail(
      process.env.DEFAULT_SUPPORT_EMAIL,
      user.email,
      emailContent
    );
  }
  async newPassword(password, resetToken) {
    const query = {
      resetToken,
      expireToken: { $gt: Date.now() },
    };
    //userService
    const user = await this.authenticationRepository.getUser(query);

    if (!user) {
      throw exceptions.entityNotFound("Sessão expirada");
    }

    const salt = await bcrypt.genSalt(10);
    const newPass = await bcrypt.hash(password, salt);

    const data = { password: newPass, resetToken: null, expireToken: null };

    //userService
    return await this.authenticationRepository.updateUser(user._id, data);
  }
  async editPassword(id, oldPass, newPass) {
    //userService
    const user = await this.authenticationRepository.getUser({ _id: id });

    if (!user || user.comparePassword(oldPass)) {
      throw exceptions.entityNotFound("Usuário não encontrado");
    }

    const salt = await bcrypt.genSalt(10);

    const password = await bcrypt.hash(newPass, salt);

    //userService
    return await this.authenticationRepository.updateUser(user._id, {
      password,
    });
  }
  async editUsername(id, username) {
    //userService
    const user = await this.authenticationRepository.getUser({
      isDeleted: false,
      _id: id,
    });

    if (!user) {
      throw exceptions.entityNotFound("Usuário não encontrado");
    }

    //userService
    return await this.authenticationRepository.updateUser(user, { username });
  }
  async editEnterpriseName(id, enterpriseName) {
    const user = this.authenticationRepository.getUser({
      isDeleted: false,
      _id: id,
    });

    if (!user) {
      throw exceptions.entityNotFound("Usuário não encontrado");
    }

    return await this.authenticationRepository.updateUser(user._id, {
      enterpriseName,
    });
  }
}
module.exports = AuthenticationService;
