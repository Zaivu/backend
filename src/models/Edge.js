const mongoose = require("mongoose");

const edgeSchema = new mongoose.Schema({
  flowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "FlowModel",
  },
  id: {
    type: String,
    required: true,
  },
  type: {
    type: String,
  },
  target: {
    type: String,
    required: true,
  },
  data: {
    type: Object,
  },
  style: {
    type: Object,
  },
  targetHandle: {
    type: String,
  },
  sourceHandle: {
    type: String,
  },
  source: {
    type: String,
    required: true,
  },
  label: {
    type: String,
  },
  labelStyle: {
    type: Object,
  },
  animated: {
    type: Boolean,
  },
  enterpriseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

mongoose.model("Edge", edgeSchema);
