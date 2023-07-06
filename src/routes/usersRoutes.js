const express = require('express');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const multer = require('multer');
const Post = mongoose.model('Post');
const requireAuth = require('../middlewares/requireAuth');
const router = express.Router();
const multerConfig = require('../config/multer');
const crypto = require('crypto');
const AWS = require('aws-sdk');
const checkPermission = require('../middlewares/userPermission');
const exceptions = require('../exceptions');
AWS.config.update({ region: process.env.AWS_DEFAULT_REGION });
router.use(requireAuth);

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

//Gerar token
async function generateToken() {
  const buffer = await new Promise((resolve, reject) => {
    crypto.randomBytes(256, function (ex, buffer) {
      if (ex) {
        reject('error generating token');
      }
      resolve(buffer);
    });
  });
  const token = crypto.createHash('sha1').update(buffer).digest('hex');

  return token;
}

async function getAvatar(userId) {
  let avatar = process.env.DEFAULT_PROFILE_PICTURE;
  const hasPicture = await Post.findOne({ originalId: userId });

  if (hasPicture) {
    avatar = hasPicture.url;
  }

  return avatar;
}

//Pagination Members
router.get('/users/pagination/:page', async (req, res) => {
  const { page = '1' } = req.params;
  const user = req.user;
  const tenantId = user.tenantId ? user.tenantId : user._id;
  const { userSearch = '' } = req.query;

  try {
    // console.log(req.query, { page }, { SortedBy }, { isAlpha, isCreation });

    const paginateOptions = {
      page,
      limit: 4,
    };

    const Pagination = await User.paginate(
      {
        $and: [
          { $or: [{ _id: tenantId }, { tenantId }, { _id: user._id }] },
          { isDeleted: { $ne: true } },
        ],
        username: { $regex: userSearch, $options: 'i' },
      },

      paginateOptions
    );

    const users = Pagination.docs;
    const totalPages = Pagination.totalPages;

    const filtering = await Promise.all(
      users.map(async (item) => {
        let avatar = process.env.DEFAULT_PROFILE_PICTURE;
        const hasPicture = await Post.findOne({ originalId: item._id });

        if (hasPicture) {
          avatar = hasPicture.url;
        }

        return (item = {
          rank: item.rank,
          status: item.status,
          username: item.username,
          email: item.email,
          enterpriseName: item.enterpriseName,
          tenantId: item.tenantId,
          _id: item._id,
          avatarURL: avatar,
        });
      })
    );

    res.send({ users: filtering, pages: totalPages });
  } catch (err) {
    console.log(err);
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});

//List all to task accountable's
router.get('/users/accountables/task', checkPermission, async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenantId ? user.tenantId : user._id;

    const query =
      user.rank === 'gerente'
        ? {
            $or: [{ tenantId }, { _id: user._id }],
            $and: [{ isDeleted: false, status: 'active' }],
          }
        : {
            $or: [{ tenantId }, { _id: tenantId }],
            $and: [{ isDeleted: false, status: 'active' }],
          };

    const usersByTenant = await User.find(query).select('-password');

    const usersWithAvatars = await Promise.all(
      usersByTenant.map(async (user) => {
        const avatar = await getAvatar(user._id);
        const plainUser = user.toObject({ getters: true, virtuals: true });
        return { ...plainUser, avatarURL: avatar };
      })
    );

    res.status(200).send({ usersByTenant: usersWithAvatars });
  } catch (err) {
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});
//List all to flow accountable's
router.get('/users/accountables/flow', checkPermission, async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenantId ? user.tenantId : user._id;

    const query =
      user.rank === 'gerente'
        ? {
            $or: [{ tenantId }, { _id: user._id }],
            $and: [{ isDeleted: false, status: 'active', rank: 'gerente' }],
          }
        : {
            $or: [{ tenantId }, { _id: tenantId }],
            $and: [
              {
                isDeleted: false,
                status: 'active',
                rank: { $ne: 'colaborador' },
              },
            ],
          };

    const usersByTenant = await User.find(query).select('-password');

    const usersWithAvatars = await Promise.all(
      usersByTenant.map(async (user) => {
        const avatar = await getAvatar(user._id);
        const plainUser = user.toObject({ getters: true, virtuals: true });
        return { ...plainUser, avatarURL: avatar };
      })
    );

    res.status(200).send({ usersByTenant: usersWithAvatars });
  } catch (err) {
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});

//Fetch avatar
router.get('/users/picture/', async (req, res) => {
  var picture;

  const { _id: originalId } = req.user;

  picture = await Post.findOne({ originalId });

  if (!picture) {
    res.send({
      url: process.env.DEFAULT_PROFILE_PICTURE,
    });
  } else {
    res.send({ url: picture.url });
  }
});

//Melhorar rank de usuário colab
router.put('/users/rank/upgrade/', checkPermission, async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await User.findOne({ _id: userId });

    if (!user) {
      throw exceptions.entityNotFound();
    }

    if (user.rank !== 'colaborador') {
      throw new Error('Only Colaborators can be promoted');
    }
    const update = await User.findOneAndUpdate(
      { _id: userId },
      { $set: { rank: 'gerente' } },
      { new: true }
    );

    res.status(200).send({ user: update });
  } catch (err) {
    console.log(err);
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});

//Reduzir rank de usuário gerente
router.put('/users/rank/downgrade/', checkPermission, async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await User.findOne({ _id: userId });

    if (!user) {
      throw exceptions.entityNotFound();
    }

    if (user.rank !== 'gerente') {
      throw new Error('Only Managers can be Demoted');
    }

    const update = await User.findOneAndUpdate(
      { _id: userId },
      { $set: { rank: 'colaborador' } },
      { new: true }
    );

    res.status(200).send({ user: update });
  } catch (err) {
    console.log(err);
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});

//Adicionar avatar
router.put(
  '/users/profile/picture/new',
  multer(multerConfig).single('file'),
  async (req, res) => {
    try {
      const { originalname: name, size, key, location: url = '' } = req.file;
      const { _id: originalId, tenantId } = req.user;

      const tenant = tenantId ? tenantId : originalId;

      const oldPost = await Post.findOne({ originalId });

      if (oldPost) {
        await oldPost.remove();
      }

      const post = await Post.create({
        name,
        size,
        key,
        url,
        originalId,
        tenantId: tenant,
        type: 'avatar',
      });

      res.send(post).status(200);
    } catch (err) {
      const code = err.code ? err.code : '412';

      res.status(code).send({ error: err.message, code });
    }
  }
);

//Deletar foto de avatar
router.delete('/users/profile/picture/delete/:originalId', async (req, res) => {
  const { originalId } = req.params;
  const post = await Post.findOne({ originalId });

  if (post) {
    await post.remove();
  }

  res.send({
    url: process.env.DEFAULT_PROFILE_PICTURE,
  });
});

//Deletar usuário com Restições
router.delete('/users/:userId', checkPermission, async (req, res) => {
  try {
    const userId = req.body.userId;
    const thisUser = req.user;

    const toDelete = await User.findOne({
      _id: userId,
      tenantId: thisUser._id,
    });

    //Caso o usuário n seja admin e não seja a relação gerente -> colaborador
    // ou o id do usuário pra deletar seja o mesmo do logado
    if (
      (thisUser.rank !== 'admin' &&
        !(thisUser.rank === 'gerente' && toDelete.rank === 'colaborador')) ||
      thisUser._id === userId
    ) {
      throw exceptions.unprocessableEntity();
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { isDeleted: true },
      { new: true }
    );

    //Buscar por todas as tarefas que task.data.accountable.userId ===toDelete._id
    //accountalbe = null

    res.status(200).send({ user: updatedUser });
  } catch (err) {
    res.status(422).send(err.message);
  }
});

//? Part de envio de link
//Cria usuário e envia link de registro
router.put('/users/send-register-link', async (req, res) => {
  const { name, email, rank } = req.body;

  try {
    const user = req.user;
    const tenantId = user.tenantId ? user.tenantId : user._id;

    const enterpriseUser = await User.findById(tenantId);

    if (await User.findOne({ email })) {
      res.send({ error: 'Email já cadastrado' });
    } else {
      // const token = await generateToken();
      const token2 = await generateToken();

      const user = new User({
        username: name,
        password: 'inactive',
        tenantId: tenantId,
        enterpriseName: enterpriseUser.enterpriseName,
        rank: rank,
        email: email,
        resetToken: token2,
        expireToken: Date.now() + 3600000 * 48,
      });
      await user.save();

      sendEmail(
        process.env.DEFAULT_SUPPORT_EMAIL,
        email,
        `Zaivu: Olá ${name}, Bem vindo à ${enterpriseUser.enterpriseName}!`,
        `Olá ${name}, Bem vindo à ${enterpriseUser.enterpriseName}! Segue abaixo um link de cadastro que irá expirar em 48 horas: <a href="${process.env.APP_URL}/newaccount/${token2}">Clique aqui</a>`
      );

      let newUser = JSON.parse(JSON.stringify(user));
      delete newUser['password'];

      res.status(200).send({ user: newUser });
    }
  } catch (err) {
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});

//Reenviar link de email
router.put('/users/resend-email', async (req, res) => {
  console.log('Backend reached, Resend-email called!');
  const { id } = req.body;

  try {
    const token = await generateToken();

    const user = await User.findByIdAndUpdate(id, {
      resetToken: token,
      expireToken: Date.now() + 3600000 * 48,
    });
    const enterpriseUser = await User.findById(user.tenantId);

    sendEmail(
      process.env.DEFAULT_SUPPORT_EMAIL,
      user.email,
      `Zaivu: Olá ${user.username}, Bem vindo à ${enterpriseUser.enterpriseName}!`,
      `Olá ${user.username}, Bem vindo à ${enterpriseUser.enterpriseName}! Segue abaixo um link de cadastro que irá expirar em 48 horas: <a href="${process.env.APP_URL}/newaccount/${token}">Clique aqui</a>`
    );

    res.status(200).send({ msg: 'ok' });
  } catch (err) {
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});

module.exports = router;
