/**
 * Crawler movies, users and reviews
 */

var request = require('request-promise');
var cheerio = require('cheerio');
var moment = require('moment');
var fs = require('fs');
var log4js = require('log4js');
const puppeteer = require('puppeteer');

// models
var Movie = require('../models/movie');
var Review = require('../models/review');

// write log
log4js.configure({
    appenders: {
        info: { type: 'file', filename: 'info.log' },
        error: { type: 'file', filename: 'error.log' },
    },
    categories: {
        default: { appenders: ['info'], level: 'info' },
        info: { appenders: ['info'], level: 'info' },
        error: { appenders: ['error'], level: 'error' },
    }
});

const infoLogger = log4js.getLogger('info');
const errorLogger = log4js.getLogger('error');

var log = JSON.parse(fs.readFileSync('./log.json'));

/**
 * Crawl popular movies  
 */
exports.crawlMovies = async (pageToCrawl = 1, fromDate, toDate = null) => {
    infoLogger.info('Starting crawl...');
    // if toDate is null, then assign toDate = fromDate
    if (!toDate) {
        toDate = fromDate;
    }

    fromDate = moment(fromDate).format("YYYY-MM-DD");
    toDate = moment(toDate).format("YYYY-MM-DD");

    (async function loopCrawl(pages) {
        request(`https://www.imdb.com/search/title/?title_type=feature&release_date=${fromDate},${toDate}&start=${50 * (pages - 1) + 1}&ref_=adv_nxt`).then(body => {
            var movies = [];
            var $ = cheerio.load(body);

            let listWrapper = $('.lister');
            if (listWrapper) {
                $('.lister-item-content').each(async (index, element) => {
                    let item = {
                        imdb_id: $('.lister-item-header a', element).prop('href').substr(7, 9),
                        title: $('.lister-item-header a', element).text(),
                        genres: $('.text-muted .genre', element).text().replace('\n', '').trim().split(', '),
                        avgRate: $('.ratings-imdb-rating', element).length ? parseFloat($('.ratings-imdb-rating', element).prop("data-value")) : 0,
                        releaseDate: fromDate
                    };

                    movies.push(item);
                });
            }

            return movies;
        }).then(movies => {
            console.log(movies.length);
            if (movies.length) {
                // fs.writeFileSync(`./data/movies/movie_${fromDate}.json`, JSON.stringify(movies), { encoding: 'utf8', flag: 'a' }, (err) => {
                //     errorLogger.error(err);
                // });
                Movie.insertMany(movies, { ordered: false }, (err, res) => {
                    if (err) {
                        errorLogger.error(err);
                    }

                    console.log("Crawled done!")
                })
            }
        }).catch(err => {
            errorLogger.error(err);
        });

        setTimeout(function () {
            if (--pages) {
                loopCrawl(pages);
            }
        }, 5000);
    })(pageToCrawl);
}

/**
 * Crawl reviews of specific movie
 */
exports.crawlReviews = async (movieId) => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(`https://www.imdb.com/title/${movieId}/reviews?sort=submissionDate&dir=desc&ratingFilter=0`);
    await page.addScriptTag({ url: 'https://code.jquery.com/jquery-3.2.1.min.js' });


    var reviewsInDB = await Review.find({ movie_imdb_id: movieId }).sort({ created_at: -1 }).exec();
    var lastestReview = reviewsInDB[0];
    var lastestCrawlTimestamp = lastestReview ? lastestReview.created_at : '01/01/1970';
    var crawledPage = Math.ceil(reviewsInDB.length / 25);
    var totalReviews = await page.$eval(".lister .header span", el => el.innerText);
    totalReviews = totalReviews.split(" ")[0].replace('.', '').replace(',', '');
    console.log(totalReviews);
    var totalPages = Math.ceil(parseInt(totalReviews) / 25);
    var pageToCrawl = crawledPage ? (totalPages - crawledPage + 1) : totalPages;

    if (pageToCrawl > 1) {
        let temp = pageToCrawl - 1;

        (async function loopClick(pageNumber) {
            await page.click('#load-more-trigger');

            setTimeout(function () {
                if (--pageNumber) {
                    loopClick(pageNumber);
                }
            }, 2500);
        })(temp);
    }

    setTimeout(async () => {
        var userReviews = await page.evaluate((movieId, lastestCrawlTimestamp) => {
            const $ = window.$;

            var reviews = [];

            $('.imdb-user-review').each(function (index, element) {
                var reviewDate = $($(element).find('.review-date')[0]).text();
                if (new Date(reviewDate) > new Date(lastestCrawlTimestamp)) {
                    reviews.push({
                        movie_imdb_id: movieId,
                        user_id: $($($(element).find('.display-name-link')[0]).find('a')[0]).attr('href').substr(6, 11),
                        rating: $($($(element).find('.rating-other-user-rating')[0]).find('span')[0]).text() || 0,
                        content: $($(element).find('.title')[0]).text()
                    })
                }
            });

            return reviews;
        }, movieId, lastestCrawlTimestamp);

        Review.create(userReviews, { ordered: false }, (err, res) => {
            console.log(err);
            // console.log(res);
        });

        await browser.close();
        console.log(`Crawl ${movieId} done!`);


    }, 2700 * pageToCrawl);
}