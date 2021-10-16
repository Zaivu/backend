const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = mongoose.model("User");
const crypto = require("crypto");
const secret = require("../middlewares/config");
const bcrypt = require("bcrypt");
const router = express.Router();
const AWS = require("aws-sdk");
AWS.config.update({ region: process.env.AWS_DEFAULT_REGION });

router.post("/auth/sign-up", async (req, res) => {
  const { nickname, username, password, enterpriseId, rank, email } = req.body;

  try {
    if ((await User.findOne({ email })) || (await User.findOne({ nickname }))) {
      res.status(422).send({ error: "Email ou usuário já cadastrados" });
    } else {
      const user = new User({
        nickname,
        username,
        password,
        enterpriseId,
        rank,
        email,
      });
      await user.save();

      const userCopy = JSON.parse(JSON.stringify(user));

      delete userCopy["password"];

      res.send({ user: userCopy });
    }
  } catch (err) {
    return res.status(422).send(err.message);
  }
});

router.post("/auth/sign-in", async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res
      .status(422)
      .send({ error: "Must provide username and password" });
  }

  const user = await User.findOne({
    $or: [{ email: login }, { nickname: login }],
  });

  console.log(user);

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

    const userCopy = JSON.parse(JSON.stringify(user));

    delete userCopy["password"];

    const response = {
      token,
      refreshToken,
      user: userCopy,
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

  async function sendEmail(fromAddress, toAddress, subject, body) {
    const ses = new AWS.SESV2();
    var params = {
      Content: {
        Simple: {
          Body: {
            Html: { Data: body, Charset: "UTF-8" }, //ISO-8859-1
          },
          Subject: { Data: subject, Charset: "UTF-8" }, //ISO-8859-1
        },
      },
      Destination: { ToAddresses: [toAddress] },
      FeedbackForwardingEmailAddress: fromAddress,
      FromEmailAddress: fromAddress,
      ReplyToAddresses: [fromAddress],
    };
    await ses.sendEmail(params).promise();
  }

  crypto.randomBytes(32, (err, buffer) => {
    if (err) console.log(err);
    const token = buffer.toString("hex");
    User.findOne({ email }).then((user) => {
      if (user) {
        user.resetToken = token;
        user.expireToken = Date.now() + 3600000;
        user.save().then(() => {
          sendEmail(
            process.env.DEFAULT_SUPPORT_EMAIL,
            email,
            "Redefinir senha",
            `Para redefinir sua senha: <a href="${process.env.APP_URL}/resetpassword/${token}">Clique aqui</a>`
          );
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
    const newUser = await User.findByIdAndUpdate(
      id,
      { username },
      { new: true }
    );

    res.send(newUser);
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

      res.send(newUser);
    }
  } catch (err) {
    return res.status(422).send(err.message);
  }
});

router.put("/auth/edit-nickname", async (req, res) => {
  const { nickname, id } = req.body;

  try {
    if (await User.findOne({ nickname })) res.send("Apelido já existe");
    else {
      const newUser = await User.findByIdAndUpdate(
        id,
        { nickname },
        { new: true }
      );

      res.send(newUser);
    }
  } catch (err) {
    return res.status(422).send(err.message);
  }
});

module.exports = router;
