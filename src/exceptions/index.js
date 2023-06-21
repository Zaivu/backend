module.exports = {
  entityNotFound: () => {
    const error = new Error('Entity not found');
    error.code = '404';

    return error;
  },
  acessDenied: (msg = null) => {
    const message = msg ? ' - ' + msg : '';
    const error = new Error('Access Denied ' + message);
    error.code = '403';

    return error;
  },
  unprocessableEntity: (msg = null) => {
    const message = msg ? ' - ' + msg : '';
    const error = new Error('Unprocessable Entity' + message);
    error.code = '412';
    return error;
  },
  alreadyExists: () => {
    const error = new Error('Entity already exists');
    error.code = '409';

    return error;
  },
};
