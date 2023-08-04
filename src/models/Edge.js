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
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  isDeleted: {
    type: Boolean,
    default: false,
    required: true,
  },
});

module.export =  mongoose.model("Edge", edgeSchema);
