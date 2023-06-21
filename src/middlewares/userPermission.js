//const exceptions = require('../exceptions');
module.exports = (req, res, next) => {
  // Assuming you have the user's rank stored in the user object
  const userRank = req.user.rank;

  // Check if the user's rank is 'admin' or 'manager'
  if (userRank !== 'admin' && userRank !== 'gerente') {
    //throw exceptions.acessDenied();
    return res.status(403).json({ message: 'Access denied.' });
  }

  // If the user has the required rank, proceed to the next middleware or route handler
  next();
};
