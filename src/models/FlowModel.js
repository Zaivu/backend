const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

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
    default: "main",
    required: true,
  },
  tenantId: {
    //enterpriseID
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: function () {
      return this.type === "main" ? false : true;
    },

    ref: "FlowModel",
  },
  default: {
    type: mongoose.Schema.Types.ObjectId,
  },
  lastUpdate: {
    type: Date,
    required: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
    required: true,
  },
});

flowModelSchema.plugin(mongoosePaginate);
module.exports = mongoose.model("FlowModel", flowModelSchema);
