const express = require("express");
const mongoose = require("mongoose");
const User = mongoose.model("User");
const requireAuth = require("../middlewares/requireAuth");
const router = express.Router();

const redis = require("redis");
const util = require("util");

const client = redis.createClient({
  port: 6379,
  host: "redis-cluster.0bhmx9.clustercfg.sae1.cache.amazonaws.com",
});

let get = util.promisify(client.get).bind(client);
let set = util.promisify(client.set).bind(client);
let del = util.promisify(client.del).bind(client);

client.on("error", (err) => {
  console.log("DEU ERRO NO REDIS", err);
});

router.use(requireAuth);

router.get("/employees/:enterpriseId", async (req, res) => {
  const { enterpriseId } = req.params;

  const result = await get(`users/${enterpriseId}`);

  if (!result) {
    try {
      const users = await User.find({ enterpriseId, rank: "Funcionário" });

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

      await del(`users/${enterpriseId}`);

      res.send({ userId: user._id });
    } catch (err) {
      return res.status(422).send(err.message);
    }
  }
);

module.exports = router;
