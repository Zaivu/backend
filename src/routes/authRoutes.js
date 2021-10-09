const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = mongoose.model("User");
const crypto = require("crypto");
const secret = require("../middlewares/config");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const router = express.Router();
const RedisClustr = require("redis-clustr");

const redis = require("redis");
const util = require("util");

const client = new RedisClustr({
  servers: [
    {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
    },
  ],
  createClient: function (port, host) {
    // this is the default behaviour
    return redis.createClient(port, host);
  },
});

let get = util.promisify(client.get).bind(client);
let set = util.promisify(client.set).bind(client);
let del = util.promisify(client.del).bind(client);

client.on("error", (err) => {
  console.log("DEU ERRO NO REDIS", err);
});

router.post("/auth/sign-up", async (req, res) => {
  const { username, password, enterpriseId, rank, email } = req.body;

  try {
    if ((await User.findOne({ username })) || (await User.findOne({ email })))
      res.send("Email ou usuário já cadastrados");
    else {
      const user = new User({ username, password, enterpriseId, rank, email });
      await user.save();
      await del(`users/${enterpriseId}`);
      res.send({ user });
    }
  } catch (err) {
    return res.status(422).send(err.message);
  }
});

router.post("/auth/sign-in", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(422)
      .send({ error: "Must provide username and password" });
  }

  const user = await User.findOne({ $or: [{ email: username }, { username }] });

  if (!user) {
    return res.status(404).send({ error: "Invalid password or username." });
  }

  try {
    await user.comparePassword(password);

    const token = jwt.sign({ userId: user._id }, secret.config.jwtSecret, {
      expiresIn: secret.config.jwtLife,
    });
    const refreshToken = jwt.sign(
      { userId: user._id },
      secret.config.jwtRefreshSecret,
      { expiresIn: secret.config.jwtRefreshLife }
    );

    let userEnterprise = { username: "none" };

    if (user.rank === "Funcionário")
      userEnterprise = await User.findOne({
        _id: user.enterpriseId,
      });

    const response = {
      token,
      refreshToken,
      user,
      enterpriseName: userEnterprise.username,
    };

    res.status(200).json(response);
  } catch (err) {
    return res.status(401).send({ error: "Invalid token" });
  }
});

router.post("/auth/new-token", async (req, res) => {
  const { refreshToken, userId } = req.body;
  jwt.verify(
    refreshToken,
    secret.config.jwtRefreshSecret,
    async (err, payload) => {
      if (err) {
        return res.status(401).send({ error: "Invalid request" });
      }

      const token = jwt.sign({ userId }, secret.config.jwtSecret, {
        expiresIn: secret.config.jwtLife,
      });
      const response = {
        token: token,
      };
      res.status(200).json(response);
    }
  );
});

router.put("/auth/reset-password-email", async (req, res) => {
  const { email } = req.body;

  crypto.randomBytes(32, (err, buffer) => {
    if (err) console.log(err);
    const token = buffer.toString("hex");
    User.findOne({ email }).then((user) => {
      if (user) {
        user.resetToken = token;
        user.expireToken = Date.now() + 3600000;
        user.save().then((result) => {
          let transporter = nodemailer.createTransport({
            name: "aprimoro.com",
            host: "mail.aprimoro.com",
            port: 587,
            secure: false,
            auth: {
              user: "suporte@aprimoro.com",
              pass: "Aprimoro@2021",
            },
            tls: {
              rejectUnauthorized: false,
            },
          });

          let msg = {
            from: "suporte@aprimoro.com",
            to: email,
            subject: "Redefinir senha",
            html: `Para redefinir sua senha: <a href="https://movi.aprimoro.com/resetpassword/${token}">Clique aqui</a>`,
          };

          transporter.sendMail(msg, function (error, info) {
            if (error) {
              console.log(error);
            } else {
              console.log("Email enviado: " + info.response);
            }
          });
        });
      }
    });
  });

  res.send("sucesso");
});

router.put("/auth/new-password", async (req, res) => {
  const { password, resetToken } = req.body;

  const user = await User.findOne({
    resetToken,
    expireToken: { $gt: Date.now() },
  });

  if (!user) {
    res.status(422).json({ error: "tente novamente, sessão expirada" });
    return null;
  }

  const salt = await bcrypt.genSalt(10);
  const newPass = await bcrypt.hash(password, salt);

  await User.findOneAndUpdate(
    { resetToken },
    { password: newPass, resetToken: undefined, expireToken: undefined }
  );

  res.json({ message: "senha redefinida com sucesso" });
});

router.put("/auth/edit-username", async (req, res) => {
  const { username, id } = req.body;

  try {
    if (await User.findOne({ username })) res.send("Nome de usuário já existe");
    else {
      const newUser = await User.findByIdAndUpdate(
        id,
        { username },
        { new: true }
      );

      if (newUser.rank === "Funcionário") {
        await del(`users/${newUser.enterpriseId}`);
      }

      res.send(newUser);
    }
  } catch (err) {
    return res.status(422).send(err.message);
  }
});

router.put("/auth/edit-password", async (req, res) => {
  const { oldPass, newPass, id } = req.body;

  try {
    const user = await User.findById(id);

    await user.comparePassword(oldPass);

    const salt = await bcrypt.genSalt(10);

    const password = await bcrypt.hash(newPass, salt);

    await User.findByIdAndUpdate(id, { password });

    res.send("Senha atualizada com sucesso");
  } catch (err) {
    return res.status(422).send(err.message);
  }
});

router.put("/auth/edit-email", async (req, res) => {
  const { email, id } = req.body;

  try {
    if (await User.findOne({ email })) res.send("Email já existe");
    else {
      const newUser = await User.findByIdAndUpdate(
        id,
        { email },
        { new: true }
      );

      if (newUser.rank === "Funcionário") {
        await del(`users/${newUser.enterpriseId}`);
      }

      res.send(newUser);
    }
  } catch (err) {
    return res.status(422).send(err.message);
  }
});

module.exports = router;
