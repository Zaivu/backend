const mongoose = require("mongoose");
mongoose.plugin(require("mongoose-xray"));

const activedNodeSchema = new mongoose.Schema({
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
  enterpriseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

mongoose.model("ActivedNode", activedNodeSchema);
