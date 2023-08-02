

// In your Node.js app, before using the AWS SDK, configure your credentials.

const { confirmNode } = require("../lambdas/confirm-node");
//Job para o timer
/**
 * Identificador: key
 * options: delay, timestamp etc..
 * handle: Função de processamento do job
 */

module.exports = {
  key: "ConfirmNode",
  options:{ delay: 5000 },
  async handle(job, done) {
    const { nodeId, edgeId, userId } = job.data;


    const payload = { nodeId, edgeId, userId };
    const res = await confirmNode(payload); //lambda

    const statusCode = res.statusCode;
    const data = res.body;

    if(statusCode === 200){
      done(null, { msg: data } )
    }else{
      done(new Error('Error when invoking lambda'))
    }


    //chamar lambda aqui com os dados
  },
};
