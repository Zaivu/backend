const Queue = require("bull");
const redisConfig = require("../config/redis");

const jobs = require("../jobs");


const queues = Object.values(jobs).map((job) => ({
  bull: new Queue(job.key, redisConfig),      //Fila 
  name: job.key,                              //Identificador
  handle: job.handle,                         //Processamento
  options: job.options,                       //Opções
}));


module.exports = {
  queues,
  add(name, data, options) { // Pode passar um custom options aqui

    const currentlyOptions = options ? options : queue.options;

    const queue = this.queues.find((queue) => queue.name === name);

    return queue.bull.add(data, currentlyOptions);
  },
 process() {
    return this.queues.forEach((queue) => {
      
     queue.bull.process(queue.handle);

     
     queue.bull.on('completed', (job) => {
         
        console.log('job completed: ', { id: job.id, nodeId: job.data.nodeId, return: job.returnvalue })

      })
      queue.bull.on("failed", (job, err) => {
   
        console.log("Job failed -> ", queue.name, job.data);
        console.log(err);
      });
    });
  },
};
