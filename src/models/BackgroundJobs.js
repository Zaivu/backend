const mongoose = require("mongoose");
const Queue = require("../lib/Queue");
const { DateTime } = require("luxon");

const backgroundJobsSchema = new mongoose.Schema({
  flowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "FlowModel",
    required: true,
  },
  jobId:{
    type: mongoose.Schema.Types.ObjectId,
    ref: "ActivedNode",
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  payload: {
    type: Object,
  },

  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ['doing', 'done', 'suspended'],
    default: 'doing',
    required: true,
  },
  createdAt: {
    type: Date,
    required: true,
  },
});


backgroundJobsSchema.pre('save', async function (next) {
    // Create a background Job
    const nowLocal = DateTime.now().toMillis();
    const payload = this.payload;
    const delay = payload.expectedAt - nowLocal;


    await Queue.add("ConfirmNode", payload, { jobId: payload.nodeId, delay });    
    next();
  });




mongoose.model("BackgroundJobs", backgroundJobsSchema);
