const mongoose = require("mongoose");

const nodeSchema = new mongoose.Schema({
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
    required: true,
  },
  position: {
    type: Object,
    required: true,
  },
  data: {
    type: Object,
  },
  targetPosition: {
    type: String,
  },
  sourcePosition: {
    type: String,
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

mongoose.model("Node", nodeSchema);
