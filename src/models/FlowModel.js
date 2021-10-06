const mongoose = require("mongoose");

const flowModelSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    required: true,
  },
  enterpriseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  originalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "FlowModel",
  },
  position: {
    type: Number,
  },
  versionNumber: {
    type: String,
  },
  defaultVersion: {
    type: String,
    default: "default",
  },
});

mongoose.model("FlowModel", flowModelSchema);
