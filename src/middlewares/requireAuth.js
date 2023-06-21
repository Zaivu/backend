const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const secret = require('../middlewares/config');

module.exports = (req, res, next) => {
  const { authorization } = req.headers;

  // console.log(req.headers, req.body, req.originalUrl);

  //console.log(authorization);
  if (!authorization) {
    return res.status(401).send({ error: 'You must be logged in.' });
  }

  const token = authorization.replace('Bearer ', '');
  jwt.verify(token, secret.config.jwtSecret, async (err, payload) => {
    if (err) {
      return res.status(401).send({ error: 'You must be logged in.' });
    }

    const { userId } = payload;

    const user = await User.findById(userId);
    req.user = user;
    next();
  });
};
