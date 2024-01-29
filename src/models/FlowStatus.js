const mongoose = require("mongoose");

const flowStatusSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  flowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ActivedFlow",
    required: true,
  },
  criticalDate: {
    type: Date,
    required: true,
  },
  estimatedAt: {
    type: Date,
    required: true,
  },
  lastUpdate: {
    type: Date,
    required: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("FlowStatus", flowStatusSchema);
