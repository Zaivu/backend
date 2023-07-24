

// In your Node.js app, before using the AWS SDK, configure your credentials.

const { hellofunction } = require("../lambdas/hello");
//Job para o timer
/**
 * Identificador: key
 * options: delay, timestamp etc..
 * handle: Função de processamento do job
 */

module.exports = {
  key: "InitTimerEvent",
  options:{ delay: 5000 },
  async handle(job, done) {
    const { nodeId } = job.data;


    const payload = { nodeId }
    const res = await hellofunction(payload);

    const statusCode = res.statusCode;
    const data = res.body;

    if(statusCode === 200){
      done(null, { msg: data } )
    }else{
      done(new Error('Error when invoking lambda: ', 'helloFunction'))
    }


    //chamar lambda aqui com os dados
  },
};
