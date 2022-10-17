const mongoose = require('mongoose');

const flowModelSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    required: true,
  },
  type: {
    type: String,
    default: 'main',
    required: true,
  },
  tenantId: {
    //enterpriseID
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: function () {
      return this.type === 'main' ? false : true;
    },

    ref: 'FlowModel',
  },
  default: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  lastUpdate: {
    type: Date,
    required: true,
  },
});

mongoose.model('FlowModel', flowModelSchema);
