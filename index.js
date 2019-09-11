const Hapi = require('hapi');
const HapiCron = require('hapi-cron');
const mongoose = require('mongoose');
var request = require('request-promise');
const Path = require('path');

const MongoDBUrl = 'mongodb://localhost:27017/imdb';

const server = Hapi.server({
    port: parseInt(process.env.PORT, 10) || 3000,
    host: 'localhost',
    routes: {
        cors: {
            origin: ['*'],
            additionalHeaders: ['sessionid', 'cache-control', 'x-requested-with']
        },
        validate: {
            failAction: async (request, h, err) => {
                if (process.env.NODE_ENV === 'production') {
                    var Boom = require('boom');
                    throw Boom.badRequest(`Invalid request payload input`);
                } else {
                    throw err;
                }
            }
        }
    }
});

const init = async () => {
    //auto loading routes directories
    await server.register({
        plugin: require('hapi-auto-route'),
        options: {
            routes_dir: Path.join(__dirname, 'routes')
        }
    });

    await server.register(require('inert'));

    // cronjob to remove pin on job
    await server.register({
        plugin: HapiCron,
        options: {
            jobs: [
                {
                    name: 'job',
                    time: '0 */5 * * * *',
                    timezone: 'Asia/Ho_Chi_Minh',
                    request: {
                        method: 'GET',
                        url: '/crawl/reviews'
                    },
                    onComplete: (res) => {
                        console.log(res);
                    }
                },
            ],
        }
    });

    await server.start();
    console.log(`Server running at: ${server.info.uri}`);

    //TODO add username and password
    //mongoose.set('debug', true);
    mongoose.connect(MongoDBUrl, {}).then(() => {
        console.log('Connected to Mongo');
    }, err => { console.log(err) });

};

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});

init();

module.exports = server;