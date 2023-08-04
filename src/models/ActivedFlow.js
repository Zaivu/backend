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
  accountable: {
    type: Object,
    default: null,
  },

  lastUpdate: {
    type: Date,
    required: true,
  },
  lastState: {
    type: Array,
    default: [],
  },
  isDeleted: {
    type: Boolean,
    default: false,
    required: true,
  },
});

activedFlowSchema.plugin(mongoosePaginate);
module.export = mongoose.model('ActivedFlow', activedFlowSchema);
