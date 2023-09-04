const Redis = require('ioredis');

// Replace these values with your Elasticache endpoint and port


const redisOptions = process.env.NODE_ENV === 'development' ? {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
} : {

  host: process.env.REDIS_URL,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  tls: {
    // Enable TLS/SSL
    rejectUnauthorized: false, // You may need to set this to true depending on your certificate setup
  },

}





const redisClient = new Redis(redisOptions);

// Test the connection
redisClient.on('connect', () => {
  console.log('**************Connected to Redis!!***************');
});

// Handle errors
redisClient.on('error', (err) => {
  console.error('Redis Error:', err);
});



module.exports = {
  redisClient,
};
