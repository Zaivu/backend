const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
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
  description: {
    type: String,
    default: '',
  },
  finishedAt: {
    type: Date,
    default: null,
  },
  comments: {
    type: String,
    default: '',
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  posts: {
    type: Array,
    default: [],
  },
  lastUpdate: {
    type: Date,
    required: true,
  },
  lastState: {
    type: Array,
    default: [],
  },
});

activedFlowSchema.plugin(mongoosePaginate);
mongoose.model('ActivedFlow', activedFlowSchema);
