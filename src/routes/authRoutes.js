const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = mongoose.model('User');
const crypto = require('crypto');
const secret = require('../middlewares/config');
const bcrypt = require('bcrypt');
const router = express.Router();
const exceptions = require('../exceptions');
const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.AWS_DEFAULT_REGION });

//Enviar email
async function sendEmail(fromAddress, toAddress, subject, body) {
  const ses = new AWS.SESV2();
  var params = {
    Content: {
      Simple: {
        Body: {
          Html: { Data: body, Charset: 'UTF-8' }, //ISO-8859-1
        },
        Subject: { Data: subject, Charset: 'UTF-8' }, //ISO-8859-1
      },
    },
    Destination: { ToAddresses: [toAddress] },
    FeedbackForwardingEmailAddress: fromAddress,
    FromEmailAddress: `Zaivu <${fromAddress}>`,
    ReplyToAddresses: [fromAddress],
  };
  await ses.sendEmail(params).promise();
}

//Validar conta | status (idle) -> status(active) e receber nova senha
router.post('/auth/sign-up/', async (req, res) => {
  const { password, username, email } = req.body;

  try {
    const salt = await bcrypt.genSalt(10);

    const newPass = await bcrypt.hash(password, salt);

    const user = await User.findOneAndUpdate(
      { email },
      {
        password: newPass,
        username,
        expireToken: null,
        resetToken: null,
        status: 'active',
      },
      { new: true }
    );

    const userCopy = JSON.parse(JSON.stringify(user));

    delete userCopy['password'];

    res.send({ user: userCopy });
  } catch (err) {
    return res.status(422).send(err.message);
  }
});

//create account for 'gerente' | 'colaborador'
router.post('/auth/create-user/colab', async (req, res) => {
  const { username, tenantId, rank = 'gerente', password, email } = req.body;

  try {
    const salt = await bcrypt.genSalt(10);
    const newPass = await bcrypt.hash(password, salt);

    const tenantUser = await User.findOne({ _id: tenantId });

    if (!tenantUser) {
      throw exceptions.entityNotFound();
    }

    const user = new User({
      username,
      email,
      enterpriseName: tenantUser.enterpriseName,
      rank,
      password: newPass,
      tenantId: tenantUser._id,
    });

    await user.save();

    const userCopy = JSON.parse(JSON.stringify(user));

    delete userCopy['password'];

    res.send({ user: userCopy });
  } catch (err) {
    return res.status(422).send(err.message);
  }
});

//Criar conta admin
router.post('/auth/create-user/admin', async (req, res) => {
  const { username, password, email, enterpriseName = '' } = req.body;

  try {
    const salt = await bcrypt.genSalt(10);
    const newPass = await bcrypt.hash(password, salt);

    const user = new User({
      username,
      email,
      enterpriseName,
      password: newPass,
      rank: 'admin',
      status: 'active',
    });

    await user.save();

    const userCopy = JSON.parse(JSON.stringify(user));

    delete userCopy['password'];

    res.send({ user: userCopy });
  } catch (err) {
    return res.status(422).send(err.message);
  }
});

//Logar contar
router.post('/auth/sign-in', async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res
      .status(422)
      .send({ error: 'Must provide username and password' });
  }

  const user = await User.findOne({ email: login });

  if (!user) {
    return res.status(404).send({ error: 'Invalid password or username.' });
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

    const userCopy = JSON.parse(JSON.stringify(user));

    delete userCopy['password'];

    const response = {
      token,
      refreshToken,
      user: userCopy,
    };

    res.status(200).json(response);
  } catch (err) {
    return res.status(401).send({ error: 'Invalid token' });
  }
});

//Gerar new token
router.post('/auth/new-token', async (req, res) => {
  const { refreshToken, userId } = req.body;
  jwt.verify(refreshToken, secret.config.jwtRefreshSecret, async (err) => {
    if (err) {
      return res.status(401).send({ error: 'Invalid request' });
    }

    const token = jwt.sign({ userId }, secret.config.jwtSecret, {
      expiresIn: secret.config.jwtLife,
    });
    const response = {
      token: token,
    };
    res.status(200).json(response);
  });
});

//Validar token
router.get('/auth/validate-token/:token', async (req, res) => {
  const { token } = req.params;

  const user = await User.findOne({ resetToken: token });

  if (user) {
    const enterpriseUser = await User.findById(user.tenantId);

    res.send({
      email: user.email,
      username: user.username,
      enterpriseName: enterpriseUser.enterpriseName,
    });
  } else {
    res.send({ error: 'not find' });
  }
});

//Resetar senha
router.put('/auth/reset-password-email', async (req, res) => {
  const { email } = req.body;

  crypto.randomBytes(32, (err, buffer) => {
    if (err) console.log(err);
    const token = buffer.toString('hex');
    User.findOne({ email }).then((user) => {
      if (user) {
        user.resetToken = token;
        user.expireToken = Date.now() + 3600000;
        user.save().then(() => {
          sendEmail(
            process.env.DEFAULT_SUPPORT_EMAIL,
            email,
            'Redefinir senha',
            `Para redefinir sua senha (irá expirar em uma hora o link): <a href="${process.env.APP_URL}/resetpassword/${token}">Clique aqui</a>`
          );
        });
      }
    });
  });

  res.send('sucesso');
});

//Nova Senha
router.put('/auth/new-password', async (req, res) => {
  const { password, resetToken } = req.body;

  const user = await User.findOne({
    resetToken,
    expireToken: { $gt: Date.now() },
  });

  if (!user) {
    res.status(422).json({ error: 'tente novamente, sessão expirada' });
    return null;
  }

  const salt = await bcrypt.genSalt(10);
  const newPass = await bcrypt.hash(password, salt);

  await User.findOneAndUpdate(
    { resetToken },
    { password: newPass, resetToken: undefined, expireToken: undefined }
  );

  res.json({ message: 'senha redefinida com sucesso' });
});

//Editar Senha
router.put('/auth/edit-password', async (req, res) => {
  const { oldPass, newPass, id } = req.body;

  try {
    const user = await User.findById(id);

    await user.comparePassword(oldPass);

    const salt = await bcrypt.genSalt(10);

    const password = await bcrypt.hash(newPass, salt);

    await User.findByIdAndUpdate(id, { password });

    res.send('Senha atualizada com sucesso');
  } catch (err) {
    return res.status(422).send(err.message);
  }
});

//Renomear usuário
router.put('/auth/edit-username', async (req, res) => {
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

//Editar Email
router.put('/auth/edit-email', async (req, res) => {
  const { email, id } = req.body;

  try {
    if (await User.findOne({ email })) res.send('Email já existe');
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

//Editar nome de empresa
router.put('/auth/edit-enterprise-name', async (req, res) => {
  const { enterpriseName, id } = req.body;

  try {
    const newUser = await User.findByIdAndUpdate(
      id,
      { enterpriseName },
      { new: true }
    );

    res.send(newUser);
  } catch (err) {
    return res.status(422).send(err.message);
  }
});

module.exports = router;
