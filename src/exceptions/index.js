module.exports = {
  entityNotFound: (msg = null) => {
    const message = msg ? ' - ' + msg : '';
    const error = new Error('Entidade não encontrada. ' + message);
    error.code = '404';

    return error;
  },
  acessDenied: (msg = null) => {
    const message = msg ? ' - ' + msg : '';
    const error = new Error('Acesso negado: ' + message);
    error.code = '403';

    return error;
  },
  unprocessableEntity: (msg = null) => {
    const message = msg ? ' - ' + msg : '';
    const error = new Error('entidade não processável' + message);
    error.code = '412';
    return error;
  },
  alreadyExists: (msg = null) => {
    const message = msg ? ' - ' + msg : '';


    const error = new Error('Entidade já existe.' + message);
    error.code = '409';

    return error;
  },
};
