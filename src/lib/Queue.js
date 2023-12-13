const Queue = require("bull");
const redisOptions = require("../config/redis");
const jobs = require("../jobs");
const sendAllJobs = require("../utils/sendAllJobs");


const queues = Object.values(jobs).map((job) => ({
  bull: new Queue(job.key, { redis: redisOptions }),      //Fila 
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
  process(BackgroundModel) {

    return this.queues.forEach((queue) => {

      queue.bull.process(queue.handle);

      queue.bull.on('completed', async (job) => {

        console.log('job completed: ', { id: job.id, return: job.returnvalue })
        await BackgroundModel.findOneAndRemove({ jobId: job.id })
        const response = JSON.parse(job.returnvalue.msg)
        const bJobs = response.action.backgroundJobs;


        const options = {
          userId: response.from.userId,
          flowId: response.action.flowId,
          type: "ConfirmNode",
        }

        await sendAllJobs(bJobs, options, BackgroundModel)

      })
      queue.bull.on("failed", async (job, err) => {

        console.log("Job failed -> ", { id: job.id, return: job.returnvalue });

        await BackgroundModel.findOneAndUpdate({ jobId: job.id }, { status: 'suspended' })

        console.log(err);
      });
    });
  },
};
