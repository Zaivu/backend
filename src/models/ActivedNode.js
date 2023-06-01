const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const activedNodeSchema = new mongoose.Schema({
  flowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FlowModel',
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
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
});

activedNodeSchema.plugin(mongoosePaginate);
mongoose.model('ActivedNode', activedNodeSchema);
