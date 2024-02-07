const AWS = require("aws-sdk");
AWS.config.update({ region: process.env.AWS_DEFAULT_REGION });

module.exports = async function (fromAddress, toAddress, subject, body) {
  const ses = new AWS.SESV2();
  var params = {
    Content: {
      Simple: {
        Body: {
          Html: { Data: body, Charset: "UTF-8" }, //ISO-8859-1
        },
        Subject: { Data: subject, Charset: "UTF-8" }, //ISO-8859-1
      },
    },
    Destination: { ToAddresses: [toAddress] },
    FeedbackForwardingEmailAddress: fromAddress,
    FromEmailAddress: `Zaivu <${fromAddress}>`,
    ReplyToAddresses: [fromAddress],
  };
  await ses.sendEmail(params).promise();
};
