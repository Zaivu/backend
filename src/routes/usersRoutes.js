const express = require("express");
const mongoose = require("mongoose");
const User = mongoose.model("User");
const multer = require("multer");
const Post = mongoose.model("Post");
const requireAuth = require("../middlewares/requireAuth");
const router = express.Router();
const multerConfig = require("../config/multer");
const crypto = require("crypto");
const AWS = require("aws-sdk");
AWS.config.update({ region: process.env.AWS_DEFAULT_REGION });

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
    FromEmailAddress: `Zaivu <${fromAddress}>`,
    ReplyToAddresses: [fromAddress],
  };
  await ses.sendEmail(params).promise();
}

async function generateToken() {
  const buffer = await new Promise((resolve, reject) => {
    crypto.randomBytes(256, function (ex, buffer) {
      if (ex) {
        reject("error generating token");
      }
      resolve(buffer);
    });
  });
  const token = crypto.createHash("sha1").update(buffer).digest("hex");

  return token;
}

router.use(requireAuth);

router.get("/employees/:enterpriseId", async (req, res) => {
  const { enterpriseId } = req.params;

  try {
    const users = await User.find({ enterpriseId });

    const user = await User.findById(enterpriseId);

    let userCopy = JSON.parse(JSON.stringify(user));
    delete userCopy["password"];

    const usersCopy = JSON.parse(JSON.stringify(users)).map((item) => {
      delete item["password"];

      return item;
    });

    usersCopy.push(userCopy);

    res.send(usersCopy);
  } catch (err) {
    return res.status(422).send(err.message);
  }
});

router.delete(
  "/employees/employee/delete/:username/:enterpriseId",
  async (req, res) => {
    const { username, enterpriseId } = req.params;

    try {
      const user = await User.findOne({ username, enterpriseId });
      await User.deleteOne({ _id: user._id });

      res.send({ userId: user._id });
    } catch (err) {
      return res.status(422).send(err.message);
    }
  }
);

router.put(
  "/users/profile/picture/new",
  multer(multerConfig).single("file"),
  async (req, res) => {
    const { originalname: name, size, key, location: url = "" } = req.file;
    const { originalId, type, enterpriseId } = req.body;

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
      type,
      enterpriseId,
    });

    return res.json(post);
  }
);

router.get("/users/profile/picture/:originalId/:type", async (req, res) => {
  const { originalId, type } = req.params;
  var picture;
  const user =
    type === "email"
      ? await User.findOne({
          email: originalId,
        })
      : await User.findOne({
          _id: originalId,
        });
  picture = await Post.findOne({ originalId: user._id });

  if (!picture) {
    res.send({
      url: process.env.DEFAULT_PROFILE_PICTURE,
    });
  } else {
    res.send({ url: picture.url });
  }
});

router.delete("/users/profile/picture/delete/:originalId", async (req, res) => {
  const { originalId } = req.params;
  const post = await Post.findOne({ originalId });

  if (post) {
    await post.remove();
  }

  res.send({
    url: process.env.DEFAULT_PROFILE_PICTURE,
  });
});

router.put("/users/send-register-link", async (req, res) => {
  const { name, email, enterpriseId, rank } = req.body;

  const enterpriseUser = await User.findById(enterpriseId);

  if (await User.findOne({ email })) {
    res.send({ error: "Email já cadastrado" });
  } else {
    const token = await generateToken();
    const token2 = await generateToken();

    const user = new User({
      username: name,
      password: "inactive",
      enterpriseId: enterpriseId,
      rank: rank,
      email: email,
      resetToken: token2,
      expireToken: Date.now() + 3600000 * 48,
      status: "pending",
    });
    await user.save();

    sendEmail(
      process.env.DEFAULT_SUPPORT_EMAIL,
      email,
      `Zaivu: Olá ${name}, Bem vindo à ${enterpriseUser.enterpriseName}!`,
      `Olá ${name}, Bem vindo à ${enterpriseUser.enterpriseName}! Segue abaixo um link de cadastro que irá expirar em 48 horas: <a href="${process.env.APP_URL}/newaccount/${token2}">Clique aqui</a>`
    );

    let newUser = JSON.parse(JSON.stringify(user));
    delete newUser["password"];

    res.send({ user: newUser });
  }
});

router.put("/users/resend-email", async (req, res) => {
  const { id } = req.body;

  const token = await generateToken();

  const user = await User.findByIdAndUpdate(id, {
    resetToken: token,
    expireToken: Date.now() + 3600000 * 48,
  });
  const enterpriseUser = await User.findById(user.enterpriseId);

  sendEmail(
    process.env.DEFAULT_SUPPORT_EMAIL,
    user.email,
    `Zaivu: Olá ${user.username}, Bem vindo à ${enterpriseUser.enterpriseName}!`,
    `Olá ${user.username}, Bem vindo à ${enterpriseUser.enterpriseName}! Segue abaixo um link de cadastro que irá expirar em 48 horas: <a href="${process.env.APP_URL}/newaccount/${token}">Clique aqui</a>`
  );

  res.send("Feito");
});

module.exports = router;
