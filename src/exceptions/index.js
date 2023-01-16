module.exports = {
  entityNotFound: () => {
    const error = new Error('Entity not found');
    error.code = '404';

    return error;
  },
  unprocessableEntity: () => {
    const error = new Error('Unprocessable Entity');
    error.code = '412';
    return error;
  },
  alreadyExists: () => {
    const error = new Error('Entity already exists');
    error.code = '409';

    return error;
  },
};
