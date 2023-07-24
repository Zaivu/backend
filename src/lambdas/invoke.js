// In your Node.js app, before using the AWS SDK, configure your credentials.
const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,

});



async function invokeLambda(functionName, payload) {
    const lambda = new AWS.Lambda();
    return new Promise((resolve, reject) => {
      lambda.invoke(
        {
          FunctionName: functionName,
          Payload: JSON.stringify(payload),
        },
        (err, data) => {
          if (err) {
            reject(err);
          } else {
            const response = JSON.parse(data.Payload);
            resolve(response);
          }
        }
      );
    });
  }


module.exports = invokeLambda

