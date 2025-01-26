const app = require('fastify')({
    logger: true
});
const keep_alive = require('./keep_alive.js')

const axios = require('axios');
const telegramBot = require('node-telegram-bot-api');
const bot = require('./controllers/insta');
const insta = require('./controllers/bot');


//run the server
const start = async () => {
    try {
        await app.listen({ port: 3000, host: '0.0.0.0' });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1)
    }
}

start();
