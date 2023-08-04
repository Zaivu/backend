const mongoose = require('mongoose');
//mongoose.Schema.Types.ObjectId,
const chatMessageSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  refId: {
    type: String,
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
    type: String,
    required: true,
  },
});

module.export =  mongoose.model('ChatMessage', chatMessageSchema);
