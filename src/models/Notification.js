const mongoose = require("mongoose");


const notificationSchema = new mongoose.Schema({
    userIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    content: {
        type: String,
        required: true
    },
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
});

module.export = mongoose.model("Notification", notificationSchema);