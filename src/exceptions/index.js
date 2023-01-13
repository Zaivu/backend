module.exports = {
  entityNotFound: () => {
    const error = new Error('Entity not found');
    error.code = '404';

    return error;
  },
};
