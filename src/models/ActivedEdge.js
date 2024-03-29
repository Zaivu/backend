const mongoose = require("mongoose");

const activedEdgeSchema = new mongoose.Schema({
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
    default: {},
  },
  targetHandle: {
    type: String,
  },
  sourceHandle: {
    type: String,
  },
  style: {
    type: Object,
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
  enterpriseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

mongoose.model("ActivedEdge", activedEdgeSchema);
