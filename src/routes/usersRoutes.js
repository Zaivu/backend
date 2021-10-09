const express = require("express");
const mongoose = require("mongoose");
const User = mongoose.model("User");
const requireAuth = require("../middlewares/requireAuth");
const router = express.Router();

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

  if (process.env.REDIS_CLUSTER === "true" || !result) {
    try {
      const users = await User.find({ enterpriseId, rank: "Funcionário" });

      if (process.env.REDIS_CLUSTER === "true")
        await set(`users/${enterpriseId}`, JSON.stringify(users));

      res.send(users);
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

module.exports = router;
