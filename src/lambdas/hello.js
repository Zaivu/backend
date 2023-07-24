const invokeLambda = require("./invoke");

// Encapsulate the invokeLambda function to control functionName
async function hellofunction(payload) {
    const functionName = 'MyFirstSAMFunction'; // Set your default function name here
    try {
      const result = await invokeLambda(functionName, payload);
      return result;
    } catch (error) {
      return error;
    }
  }
  
  module.exports = {
    hellofunction,
  };