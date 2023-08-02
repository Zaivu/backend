const invokeLambda = require("./invoke");

// Encapsulate the invokeLambda function to control functionName
async function confirmNode(payload) {
    const functionName = 'confirm-action-stack-confirmActionFunction-8SbA2D8Abyjv'; // Set your default function name here
    try {
      const result = await invokeLambda(functionName, payload);
      return result;
    } catch (error) {
      return error;
    }
  }
  
  module.exports = {
    confirmNode,
  };