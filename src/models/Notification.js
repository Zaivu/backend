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
        enum: ['mention', 'flow'],
        required: true
    },
    refId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
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