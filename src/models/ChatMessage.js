const mongoose = require("mongoose");
// const mentionsMiddleware = require('../middlewares/mentions')

//mongoose.Schema.Types.ObjectId,
const chatMessageSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  refId: {
    type: String, //flowId | taskId
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    required: true,
  },
  type: {
    type: String, //flow | task
    required: true,
  },
});

// chatMessageSchema.pre('save', mentionsMiddleware);

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
