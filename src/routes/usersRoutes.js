const express = require("express");
const mongoose = require("mongoose");
const User = mongoose.model("User");
const multer = require("multer");
const Post = mongoose.model("Post");
const requireAuth = require("../middlewares/requireAuth");
const router = express.Router();
const multerConfig = require("../config/multer");

const RedisClustr = require("redis-clustr");
const redis = require("redis");
const util = require("util");
let client;
let get;
let set;
let del;

if (process.env.REDIS_CLUSTER === "true") {
  client = new RedisClustr({
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

  get = util.promisify(client.get).bind(client);
  set = util.promisify(client.set).bind(client);
  del = util.promisify(client.del).bind(client);

  client.on("error", (err) => {
    console.log("DEU ERRO NO REDIS", err);
  });
}

router.use(requireAuth);

router.get("/employees/:enterpriseId", async (req, res) => {
  const { enterpriseId } = req.params;

  let result;

  if (process.env.REDIS_CLUSTER === "true")
    result = await get(`users/${enterpriseId}`);

  if (!result) {
    try {
      const users = await User.find({ enterpriseId, rank: "Funcionário" });

      if (process.env.REDIS_CLUSTER === "true")
        await set(`users/${enterpriseId}`, JSON.stringify(users));

      const usersCopy = JSON.parse(JSON.stringify(users)).map((item) => {
        delete item["password"];

        return item;
      });

      res.send(usersCopy);
    } catch (err) {
      return res.status(422).send(err.message);
    }
  } else {
    res.send(result);
  }
});

router.delete(
  "/employees/employee/delete/:username/:enterpriseId",
  async (req, res) => {
    const { username, enterpriseId } = req.params;

    try {
      const user = await User.findOne({ username, enterpriseId });
      await User.deleteOne({ _id: user._id });

      if (process.env.REDIS_CLUSTER === "true")
        await del(`users/${enterpriseId}`);

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

router.get("/users/profile/picture/:originalId", async (req, res) => {
  const { originalId } = req.params;
  const picture = await Post.findOne({ originalId });

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

module.exports = router;
