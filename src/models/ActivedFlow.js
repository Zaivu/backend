const mongoose = require("mongoose");

const activedFlowSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  client: {
    type: String,
  },
  status: {
    type: Array,
    default: [],
  },
  createdAt: {
    type: Date,
    required: true,
  },
  finishedAt: {
    type: Date,
    default: null,
  },
  comments: {
    type: String,
    default: "",
  },
  enterpriseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  posts: {
    type: Array,
    default: [],
  },
  lastState: {
    type: Array,
    default: [],
  },
});

mongoose.model("ActivedFlow", activedFlowSchema);
