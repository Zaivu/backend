const mongoose = require("mongoose");


const notificationSchema = new mongoose.Schema({
    createdAt: {
        type: Date,
        required: true,
    },
    content: {
        type: String,
        default: null,
    },
    type: {
        type: String,
        enum: ['task_mention', 'flow_mention', 'task_status', 'flow_status'],
        required: true
    },
    ref: {
        _id: false,
        taskId: {
            ref: "ActivedNode",
            type: mongoose.Schema.Types.ObjectId,
            default: null,

        },
        flowId: {
            ref: "ActivedFlow",
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },

    },
    sendBy: {
        ref: 'User',
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    readBy: [{
        _id: false,
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        read: {
            type: Boolean,
            default: false
        }
    }]
});

module.exports = mongoose.model("Notification", notificationSchema);