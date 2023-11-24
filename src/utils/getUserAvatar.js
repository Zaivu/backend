const Post = require('../models/Post')

module.exports = async function getAvatar(userId) {

    let avatar = process.env.DEFAULT_PROFILE_PICTURE;
    const hasPicture = await Post.findOne({ originalId: userId, type: "avatar" });

    if (hasPicture) {
        avatar = hasPicture.url;
    }

    return avatar;
}