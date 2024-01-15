const Post = require("../models/Post");
const ChatMessage = require("../models/ChatMessage");
const User = require("../models/User");
const getUserAvatar = require("./getUserAvatar");
const getMomentStatus = require("./getMomentStatus");

module.exports = async (task) => {
  const files = await Post.find({ originalId: task._id });
  const chatMessages = await ChatMessage.find({ refId: task._id });

  const accUser = task.data.accountable?.userId ?? null;

  let accountable = null;

  if (accUser) {
    const user = await User.findOne({ _id: accUser });

    if (user) {
      const avatarURL = await getUserAvatar(accUser);

      accountable = {
        userId: accUser,
        username: user.username,
        avatarURL: avatarURL,
      };
    }
  }

  const moment = getMomentStatus(task);

  return {
    label: task.data.label,
    _id: task._id,
    type: task.type,
    status: task.data.status,
    description: task.data.comments,
    subtasks: task.data.subtasks,
    duration: task.data.expiration.number,
    moment: moment,
    flowId: task.flowId,
    files: files.length,
    chatMessages: chatMessages.length,
    accountable,
  };
};
