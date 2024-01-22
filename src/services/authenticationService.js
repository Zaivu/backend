const exceptions = require("../exceptions");
const bcrypt = require("bcrypt");
class AuthenticationService {
  constructor(authenticationRepository) {
    this.authenticationRepository = authenticationRepository;
  }

  async verifyToken() {
    return await this.authenticationRepository.verifyToken();
  }
  async validateToken(token) {
    const query = { resetToken: token };

    const user = await this.authenticationRepository.getUser(query);

    if (!user) {
      throw exceptions.entityNotFound("Usuário não encontrado");
    }

    return await this.authenticationRepository.validateToken(token);
  }
  async signIn(email, password) {
    const query = { isDeleted: false, email };

    const user = await this.authenticationRepository.getUser(query);

    if (!user || user.comparePassword(password)) {
      throw exceptions.entityNotFound("Email ou Senha incorretos");
    }

    const { token, refreshToken } = await this.authenticationRepository.signJWT(
      user
    );

    const avatarURL = await this.authenticationRepository.getAvatar(user);

    const userCopy = JSON.parse(JSON.stringify(user));

    delete userCopy["password"];

    return {
      token,
      refreshToken,
      user: { ...userCopy, avatarURL },
    };
  }
  async signUp(email, password, username) {
    const user = await this.authenticationRepository.getUser({
      isDeleted: false,
      email,
    });

    if (!user) {
      throw exceptions.entityNotFound("Usuário não encontrado");
    }

    const salt = await bcrypt.genSalt(10);
    const newPass = await bcrypt.hash(password, salt);

    return await this.authenticationRepository.signUp(
      { ...user, username },
      newPass
    );
  }
  async createUserAdmin(email, password, username, enterpriseName) {
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

    const user = await this.authenticationRepository.createUser(userData);

    const userCopy = JSON.parse(JSON.stringify(user));

    delete userCopy["password"];

    return { user: userCopy };
  }
  async createUserColab(tenantId, email, username, password, rank) {
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

    const userCopy = JSON.parse(JSON.stringify(user));

    delete userCopy["password"];

    return { user: userCopy };
  }
  async newToken(userId, refreshToken) {
    return await this.authenticationRepository.newToken(userId, refreshToken);
  }
  async resetPassword(email) {
    const user = await this.authenticationRepository.getUser({ email });
    return await this.authenticationRepository.resetPassword(user);
  }
  async newPassword(password, resetToken) {
    const query = {
      resetToken,
      expireToken: { $gt: Date.now() },
    };

    const user = await this.authenticationRepository.getUser(query);

    if (!user) {
      throw exceptions.entityNotFound("Sessão expirada");
    }

    const salt = await bcrypt.genSalt(10);
    const newPass = await bcrypt.hash(password, salt);

    const data = { password: newPass, resetToken: null, expireToken: null };

    return await this.authenticationRepository.updateUser(user, data);
  }
  async editPassword(id, oldPass, newPass) {
    const user = await this.authenticationRepository.getUser({ _id: id });

    if (!user || user.comparePassword(oldPass)) {
      throw exceptions.entityNotFound("Usuário não encontrado");
    }
    const salt = await bcrypt.genSalt(10);

    const password = await bcrypt.hash(newPass, salt);

    return await this.authenticationRepository.updateUser(user._id, {
      password,
    });
  }
  async editUsername(id, username) {
    const user = await this.authenticationRepository.getUser({
      isDeleted: false,
      _id: id,
    });

    if (!user) {
      throw exceptions.entityNotFound("Usuário não encontrado");
    }

    return await this.authenticationRepository.updateUser(user, { username });
  }
  async editEmail(id, email) {
    const user = await this.authenticationRepository.getUser({
      isDeleted: false,
      email,
    });

    if (user) {
      throw exceptions.entityNotFound("Email já existe");
    }

    const currentUser = await this.authenticationRepository.getUser({
      _id: id,
    });

    if (!currentUser) {
      throw exceptions.entityNotFound("Usuário não encontrado");
    }

    return await this.authenticationRepository.updateUser(currentUser, {
      email,
    });
  }
  async editEnterpriseName(id, enterpriseName) {
    const user = this.authenticationRepository.getUser({
      isDeleted: false,
      _id: id,
    });

    if (!user) {
      throw exceptions.entityNotFound("Usuário não encontrado");
    }

    return await this.authenticationRepository.updateUser(user, {
      enterpriseName,
    });
  }
}
module.exports = AuthenticationService;
