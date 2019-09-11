var fs = require('fs');
const Crawler = require('../crawler/index');
var Movie = require('../models/movie');
var Boom = require('boom');

module.exports = [
    {
        method: 'GET',
        path: '/',
        handler: (req, h) => {

            return "IMDB Crawler";
        }
    },
    {
        method: 'GET',
        path: '/crawl/movies',
        handler: (req, h) => {
            // crawl base years
            var years = ['2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018'];

            years.forEach(year => {
                Crawler.crawlMovies(20, `${year}-01-01`, `${year}-12-31`);
            });

            // crawl base month of 2019
            var months = ['01', '02', '03', '04', '05', '06', '07', '08'];

            months.forEach(month => {
                Crawler.crawlMovies(1, `2019-${month}-01`, `2019-${month}-31`);
            });

            return ({ ok: 1 });
        }
    },
    {
        method: 'GET',
        path: '/crawl/reviews',
        handler: (req, h) => {
            fs.readFile('activity', 'utf8', async (err, data) => {
                if (err) return Boom.boomify(err, {statusCode: 422});

                data = JSON.parse(data);
                var currentPage = parseInt(data.crawledPage) + 1;  // next page

                var movies = await Movie.find({}).sort({ releaseDate: 1 }).skip(10 * (currentPage - 1)).limit(10);
                if(movies.length) {
                    movies.map(movie => {
                        Crawler.crawlReviews(movie.imdb_id);
                    });

                    if (data.crawledPage < currentPage) {
                        fs.writeFileSync('activity', JSON.stringify({ crawledPage: currentPage }));
                    }
                } else {
                    return Boom.boomify(new Error("Vuot qua so trang"), {statusCode: 422});
                }
            });

            return ({ok: 1});
        }
    }
]