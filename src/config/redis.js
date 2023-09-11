
const redisOptions = process.env.NODE_ENV === 'development' ? {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
} : {

  host: process.env.REDIS_URL,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  lazyConnect: false,
  tls: {
    // Enable TLS/SSL
    // You may need to set this to true depending on your certificate setup
  },


}



module.exports = redisOptions;
