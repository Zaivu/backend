const User = require("../models/User");
const jwt = require("jsonwebtoken");
const secret = require("../middlewares/config");
const getUserAvatar = require("../utils/getUserAvatar.js");
const exceptions = require("../exceptions/index.js");
const sendEmailSES = require("../utils/sendEmail.js");
class AuthenticationRepository {
  async verifyToken() {
    return { msg: "Login is Successful." };
  }
  //userRepository
  async getUser(query) {
    return await User.findOne(query);
  }
  async getAvatar(user) {
    return await getUserAvatar(user._id);
  }
  async signJWT(user) {
    const token = jwt.sign({ userId: user._id }, secret.config.jwtSecret, {
      expiresIn: secret.config.jwtLife,
    });
    const refreshToken = jwt.sign(
      { userId: user._id },
      secret.config.jwtRefreshSecret,
      { expiresIn: secret.config.jwtRefreshLife }
    );

    return { token, refreshToken };
  }
  //userRepository
  async createUser(data) {
    const newUser = new User(data);
    return await newUser.save();
  }
  //userRepository
  async updateUser(id, data) {
    return await User.findOneAndUpdate({ _id: id }, data, { new: true });
  }
  async newToken(userId, token) {
    return jwt.verify(token, secret.config.jwtRefreshSecret, async (err) => {
      if (err) {
        throw exceptions.acessDenied("Token was Expired");
      }

      const token = jwt.sign({ userId }, secret.config.jwtSecret, {
        expiresIn: secret.config.jwtLife,
      });
      return { token };
    });
  }
  async sendEmail(from, to, data) {
    const { subject, body } = data;
    return await sendEmailSES(from, to, subject, body);
  }
}

module.exports = AuthenticationRepository;
