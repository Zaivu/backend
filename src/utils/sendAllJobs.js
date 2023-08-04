const exceptions = require('../exceptions');
const { DateTime }  = require('luxon')



module.exports = async function (jobs, options, BackgroundModel){
    return Promise.all(jobs.map(async(item) => {


        const durationInHours = item.data.expiration.number;
        const startedAt = DateTime.fromMillis(item.data.startedAt);
        const expectedAt = startedAt.plus({ hours: durationInHours })
        const { flowId, type, userId } = options
            
        const payload = {
          nodeId: item._id,
          userId,
          expectedAt: expectedAt.toMillis(),
        }
  
  
        const jobId = payload.nodeId;


        const alreadyExist =  await BackgroundModel.findOne({ jobId }) 
  
        if(alreadyExist){
            throw exceptions.alreadyExists(`This Background job already exists`)
        }

        const  jobData = {
            flowId, 
            jobId, 
            type, 
            payload,  
            createdAt: DateTime.now().toMillis() 

        }

        const jobModel = new BackgroundModel(jobData);
        await jobModel.save();
    
        return item
  
    }))
}