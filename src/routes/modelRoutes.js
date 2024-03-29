const express = require("express");
const mongoose = require("mongoose");
const FlowModel = mongoose.model("FlowModel");
const Edge = mongoose.model("Edge");
const Node = mongoose.model("Node");
const moment = require("moment");
const requireAuth = require("../middlewares/requireAuth");
const router = express.Router();

router.use(requireAuth);

router.get("/flow-models/:enterpriseId/:page", async (req, res) => {
  const { enterpriseId, page } = req.params;

  //try {
  const number_of_pages = Math.ceil(
    (await FlowModel.count({
      enterpriseId,
      versionNumber: null,
    })) / 5
  );

  console.log(number_of_pages);

  const flows = await FlowModel.find({ enterpriseId, versionNumber: null })
    .skip(5 * (page - 1))
    .limit(5);
  const idArray = flows.map((item) => item._id);
  const nodes = await Node.find({ flowId: { $in: idArray } });
  const edges = await Edge.find({ flowId: { $in: idArray } });

  const originalFlows = flows.filter(
    (item) => item.versionNumber === undefined
  );

  const formatedFlows = originalFlows.map((item) => {
    const newNodes = nodes.filter(
      (el) => el.flowId.toString() === item._id.toString()
    );
    const newEdges = edges.filter(
      (el) => el.flowId.toString() === item._id.toString()
    );

    const versionFlows = flows.filter(
      (el) => el?.originalId?.toString() === item._id.toString()
    );

    const formatedVersionFlows = versionFlows.map((it) => {
      const newNodes = nodes.filter(
        (el) => el.flowId.toString() === it._id.toString()
      );
      const newEdges = edges.filter(
        (el) => el.flowId.toString() === it._id.toString()
      );

      const versionFlow = {
        title: it.title,
        _id: it._id,
        createdAt: it.createdAt,
        enterpriseId,
        elements: [...newNodes, ...newEdges],
        position: it.position,
        originalId: it.originalId,
        versionNumber: it.versionNumber,
      };

      return versionFlow;
    });

    const flow = {
      title: item.title,
      _id: item._id,
      createdAt: item.createdAt,
      enterpriseId,
      elements: [...newNodes, ...newEdges],
      versions: formatedVersionFlows,
      defaultVersion: item.defaultVersion ? item.defaultVersion : "default",
    };

    return flow;
  });

  res.send({ flows: formatedFlows, pages: number_of_pages });
  //} catch (err) {
  //  res.status(422).send({ error: err.message });
  //}
});

router.get(
  "/flow-models/flow/search/:enterpriseId/:flowId",
  async (req, res) => {
    const { enterpriseId, flowId } = req.params;

    //  try {
    const flow = await FlowModel.findById(flowId);

    const nodes = await Node.find({ flowId });
    const edges = await Edge.find({ flowId });

    const versionFlows = await FlowModel.find({
      originalId: flowId,
    });

    console.log(versionFlows);

    const formatedVersionFlows = await Promise.all(
      versionFlows?.map(async (it) => {
        const newNodes = await Node.find({ flowId: it._id });
        const newEdges = await Edge.find({ flowId: it._id });

        const versionFlow = {
          title: it.title,
          _id: it._id,
          createdAt: it.createdAt,
          enterpriseId,
          elements: [...newNodes, ...newEdges],
          position: it.position,
          originalId: it.originalId,
          versionNumber: it.versionNumber,
        };

        return versionFlow;
      })
    );

    const newFlow = {
      title: flow.title,
      _id: flow._id,
      createdAt: flow.createdAt,
      enterpriseId,
      elements: [...nodes, ...edges],
      versions: formatedVersionFlows,
      defaultVersion: flow.defaultVersion ? flow.defaultVersion : "default",
    };

    console.log(newFlow.defaultVersion);

    res.send({ flow: newFlow });
    // } catch (err) {
    //   res.status(422).send({ error: err.message });
    // }
  }
);

router.get(
  "/model-flows/search/:enterpriseId/:page/:title",
  async (req, res) => {
    const { enterpriseId, page, title } = req.params;

    try {
      const number_of_pages = Math.ceil(
        (await FlowModel.count({
          enterpriseId,
          title: {
            $regex: title === "undefined" ? RegExp(".*") : title,
            $options: "i",
          },
        })) / 5
      );

      const flows = await FlowModel.find({
        enterpriseId,
        title: {
          $regex: title === "undefined" ? RegExp(".*") : title,
          $options: "i",
        },
      })
        .skip(5 * (page - 1))
        .limit(5);

      const idArray = flows.map((item) => item._id);
      const nodes = await Node.find({ flowId: { $in: idArray } });
      const edges = await Edge.find({ flowId: { $in: idArray } });

      const originalFlows = flows.filter(
        (item) => item.versionNumber === undefined
      );

      const formatedFlows = originalFlows.map((item) => {
        const newNodes = nodes.filter(
          (el) => el.flowId.toString() === item._id.toString()
        );
        const newEdges = edges.filter(
          (el) => el.flowId.toString() === item._id.toString()
        );

        const versionFlows = flows.filter(
          (el) => el?.originalId?.toString() === item._id.toString()
        );

        const formatedVersionFlows = versionFlows.map((it) => {
          const newNodes = nodes.filter(
            (el) => el.flowId.toString() === it._id.toString()
          );
          const newEdges = edges.filter(
            (el) => el.flowId.toString() === it._id.toString()
          );

          const versionFlow = {
            title: it.title,
            _id: it._id,
            createdAt: it.createdAt,
            enterpriseId,
            elements: [...newNodes, ...newEdges],
            position: it.position,
            originalId: it.originalId,
            versionNumber: it.versionNumber,
          };

          return versionFlow;
        });

        const flow = {
          title: item.title,
          _id: item._id,
          createdAt: item.createdAt,
          enterpriseId,
          elements: [...newNodes, ...newEdges],
          versions: formatedVersionFlows,
          defaultVersion: item.defaultVersion ? item.defaultVersion : "default",
        };

        return flow;
      });

      res.send({ flows: formatedFlows, pages: number_of_pages });
    } catch (err) {
      res.status(422).send({ error: err.message });
    }
  }
);

router.post("/flow-models/flow-model/new-flow", async (req, res) => {
  const { title, elements, enterpriseId } = req.body;

  //try {
  const nowLocal = moment().utcOffset(-180);

  const flowModel = new FlowModel({
    title: title,
    createdAt: nowLocal,
    enterpriseId,
  });

  const flow = await flowModel.save();

  await Promise.all(
    elements.map(async (item) => {
      if (item.source) {
        const edge = new Edge({
          ...item,
          flowId: flowModel._id,
          enterpriseId,
        });
        await edge.save();
      } else {
        if (item.type === "customMark" || item.type === "customText") {
          const node = new Node({
            ...item,
            flowId: flowModel._id,
            enterpriseId,
            data: {
              ...item.data,
              referenceId: flowModel._id,
            },
          });
          await node.save();
        } else {
          const node = new Node({
            ...item,
            flowId: flowModel._id,
            enterpriseId,
          });
          await node.save();
        }
      }
    })
  );

  const edges = await Edge.find({ flowId: flow._id });
  const nodes = await Node.find({ flowId: flow._id });

  res.status(200).json({
    flow: {
      title: flow.title,
      _id: flow._id,
      createdAt: flow.createdAt,
      enterpriseId: flow.enterpriseId,
      elements: [...nodes, ...edges],
    },
  });
  //} catch (err) {
  // res.status(422).send({ error: err.message });
  //}
});

router.delete("/flow-models/flow-model/delete/:flowId", async (req, res) => {
  const { flowId } = req.params;

  try {
    const flow = await FlowModel.findOne({ _id: flowId });
    await FlowModel.findOneAndRemove({ _id: flowId });

    await Node.remove({ flowId });
    await Edge.remove({ flowId });

    res.send({ flowId });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

router.put("/flow-models/flow-model/edit", async (req, res) => {
  const { title, elements, _id } = req.body;

  try {
    const flow = await FlowModel.findOneAndUpdate(
      { _id },
      { title },
      { new: true }
    );

    await Node.remove({ flowId: _id });
    await Edge.remove({ flowId: _id });

    await Promise.all(
      elements.map(async (item) => {
        if (item.source) {
          const edge = new Edge({ ...item, flowId: _id });
          await edge.save();
        } else {
          const node = new Node({ ...item, flowId: _id });
          await node.save();
        }
      })
    );

    const nodes = await Node.find({ flowId: flow._id });
    const edges = await Edge.find({ flowId: flow._id });

    res.status(200).json({
      flow: {
        title: flow.title,
        _id: flow._id,
        createdAt: flow.createdAt,
        enterpriseId: flow.enterpriseId,
        elements: [...nodes, ...edges],
        versions: flow.versions ? flow.versions : [],
      },
    });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

router.put("/flow-models/flow-model/edit-version", async (req, res) => {
  const { elements, version, versionId, enterpriseId } = req.body;

  try {
    const flow = await FlowModel.findOneAndUpdate(
      { _id: versionId },
      { versionNumber: version },
      { new: true }
    );

    await Node.remove({ flowId: versionId });
    await Edge.remove({ flowId: versionId });

    await Promise.all(
      elements.map(async (item) => {
        if (item.source) {
          const edge = new Edge({ ...item, flowId: versionId });
          await edge.save();
        } else {
          const node = new Node({ ...item, flowId: versionId });
          await node.save();
        }
      })
    );

    const nodes = await Node.find({ flowId: versionId });
    const edges = await Edge.find({ flowId: versionId });

    res.status(200).json({
      flow: {
        title: flow.title,
        _id: flow._id,
        createdAt: flow.createdAt,
        enterpriseId: flow.enterpriseId,
        elements: [...nodes, ...edges],
        originalId: flow.originalId,
        position: flow.position,
        versionNumber: version,
      },
    });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

router.put("/flow-models/flow-model/new-version", async (req, res) => {
  const { title, elements, versionNumber, enterpriseId, _id } = req.body;

  try {
    const nowLocal = moment().utcOffset(-180);
    const allflows = await FlowModel.find({ originalId: _id });

    const flowModel = new FlowModel({
      title: title,
      createdAt: nowLocal,
      enterpriseId,
      originalId: _id,
      position: allflows?.length + 1,
      versionNumber: versionNumber,
    });

    const flow = await flowModel.save();

    await Promise.all(
      elements.map(async (item) => {
        if (item.source) {
          const edge = new Edge({
            ...item,
            flowId: flowModel._id,
            enterpriseId,
          });
          await edge.save();
        } else {
          const node = new Node({
            ...item,
            flowId: flowModel._id,
            enterpriseId,
          });
          await node.save();
        }
      })
    );

    const edges = await Edge.find({ flowId: flow._id });
    const nodes = await Node.find({ flowId: flow._id });

    res.status(200).json({
      flow: {
        title: flow.title,
        _id: flow._id,
        createdAt: flow.createdAt,
        enterpriseId: flow.enterpriseId,
        elements: [...nodes, ...edges],
        originalId: flow.originalId,
        position: flow.position,
        versionNumber: versionNumber,
      },
    });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

router.put("/flow-models/flow-model/new-default-version", async (req, res) => {
  const { flowId, defaultVersion } = req.body;

  try {
    await FlowModel.findByIdAndUpdate(flowId, { defaultVersion });

    res.status(200).json({ defaultVersion, flowId });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

router.put("/flow-models/flow-model/delete-version", async (req, res) => {
  const { versionNumber, originalId } = req.body;

  try {
    const flow = await FlowModel.findById(originalId);
    await FlowModel.findOneAndDelete({ versionNumber, originalId });

    if (flow.defaultVersion === versionNumber) {
      await FlowModel.findByIdAndUpdate(originalId, {
        defaultVersion: "default",
      });
    }

    res.status(200).json({
      defaultVersion:
        flow.defaultVersion === versionNumber ? "default" : flow.defaultVersion,
      flowId: flow._id,
      versionNumber,
    });
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

router.put("/flow-models/flow-model/task/edit", async (req, res) => {
  const { title, expiration, subtasks, taskId, version, attachFile, lockTask } =
    req.body;

  try {
    const newTask = await Node.findOneAndUpdate(
      { _id: taskId },
      {
        data: {
          label: title,
          expiration,
          subtasks,
          attachFile: attachFile,
          lockTask: lockTask,
        },
      },
      { new: true }
    );

    const flow = await FlowModel.findOne({ _id: newTask.flowId });

    if (version === "default") {
      res.send({ newTask, version, flowId: newTask.flowId });
    } else {
      res.send({ newTask, version, flowId: flow.originalId });
    }
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

router.put("/flow-models/flow-model/timer/edit", async (req, res) => {
  const { expiration, timerId, version } = req.body;

  try {
    const newTimer = await Node.findOneAndUpdate(
      { _id: timerId },
      { data: { label: "Temporizador", expiration } },
      { new: true }
    );

    const flow = await FlowModel.findOne({ _id: newTimer.flowId });

    if (version === "default") {
      res.send({ newTimer, version, flowId: newTask.flowId });
    } else {
      res.send({ newTimer, version, flowId: flow.originalId });
    }
  } catch (err) {
    res.status(422).send({ error: err.message });
  }
});

module.exports = router;
