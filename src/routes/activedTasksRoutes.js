const express = require("express");
const moment = require("moment");
const mongoose = require("mongoose");
const requireAuth = require("../middlewares/requireAuth");
const ActivedFlow = mongoose.model("ActivedFlow");
const ActivedEdge = mongoose.model("ActivedEdge");
const ActivedNode = mongoose.model("ActivedNode");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/actived-tasks/search/:enterpriseId/:title/:page/:flowTitle/:client/:status/:flowType/:employeer",
  async (req, res) => {
    const {
      enterpriseId,
      page,
      title,
      client,
      flowTitle,
      status,
      flowType,
      employeer,
    } = req.params;

    try {
      const flows = await ActivedFlow.find(
        {
          enterpriseId,
          title: {
            $regex: flowTitle === "undefined" ? RegExp(".*") : flowTitle,
            $options: "i",
          },
          client: {
            $regex: client === "undefined" ? RegExp(".*") : client,
            $options: "i",
          },
          status:
            flowType === "undefined"
              ? { $exists: true }
              : flowType === "actived"
              ? { $ne: ["finished"] }
              : ["finished"],
        },
        { lastState: 0, comments: 0 }
      );

      const idArray = flows.map((item) => item._id);

      if (status === "expired") {
        const nowLocal = moment().utcOffset(-180);

        const nodes = await ActivedNode.find({
          enterpriseId,
          "data.status":
            status === "undefined"
              ? { $exists: true }
              : status === "expired"
              ? "doing"
              : status === "doneExpired"
              ? "done"
              : status,
          "data.label": {
            $regex: title === "undefined" ? RegExp(".*") : title,
            $options: "i",
          },
          "data.expired":
            status === "doneExpired"
              ? true
              : { $ne: true } || { $exists: false },
          "data.accountable":
            employeer === "undefined" ? { $exists: true } : employeer,
          flowId: { $in: idArray },
        });
        let newNodes = [];

        nodes.forEach((e) => {
          if (
            e.data.status === "doing" &&
            moment(e.data.startedAt)
              .add(e.data.expiration.number, "hours")
              .diff(nowLocal, "hours", true) < 0
          ) {
            newNodes.push(e);
          }
        });

        const tasks = [];
        const number_of_pages = newNodes.length;

        newNodes.forEach((item, index) => {
          if (index >= (page - 1) * 5 && index < page * 5) {
            let newItem = JSON.parse(JSON.stringify(item));
            let newFlow = flows.find(
              (it) => it._id.toString() === item.flowId.toString()
            );

            newItem.data.client = newFlow.client;
            newItem.data.flowTitle = newFlow.title;

            tasks.push(newItem);
          }
        });

        res.send({ tasks: tasks, pages: number_of_pages });
      } else {
        const number_of_pages = Math.ceil(
          (await ActivedNode.count({
            enterpriseId,
            "data.status":
              status === "undefined"
                ? { $exists: true }
                : status === "expired"
                ? "doing"
                : status === "doneExpired"
                ? "done"
                : status,
            "data.label": {
              $regex: title === "undefined" ? RegExp(".*") : title,
              $options: "i",
            },
            "data.expired":
              status === "doneExpired"
                ? true
                : { $ne: true } || { $exists: false },
            "data.accountable":
              employeer === "undefined" ? { $exists: true } : employeer,
            flowId: { $in: idArray },
          })) / 5
        );

        const nodes = await ActivedNode.find({
          enterpriseId,
          "data.status":
            status === "undefined"
              ? { $exists: true }
              : status === "expired"
              ? "doing"
              : status === "doneExpired"
              ? "done"
              : status,
          "data.label": {
            $regex: title === "undefined" ? RegExp(".*") : title,
            $options: "i",
          },
          "data.expired":
            status === "doneExpired"
              ? true
              : { $ne: true } || { $exists: false },
          "data.accountable":
            employeer === "undefined" ? { $exists: true } : employeer,
          flowId: { $in: idArray },
        })
          .skip(5 * (page - 1))
          .limit(5);

        const tasks = nodes.map((item) => {
          let newItem = JSON.parse(JSON.stringify(item));
          let newFlow = flows.find(
            (it) => it._id.toString() === item.flowId.toString()
          );

          newItem.data.client = newFlow.client;
          newItem.data.flowTitle = newFlow.title;

          return newItem;
        });

        res.send({ tasks: tasks, pages: number_of_pages });
      }
    } catch (err) {
      res.status(422).send({ error: err.message });
    }
  }
);

module.exports = router;
