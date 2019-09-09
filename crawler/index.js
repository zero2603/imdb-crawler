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

// /**
//  * Crawl reviews of specific movie
//  */
// exports.crawlReviews = async (movieId) => {
//     // find the last crawl time and number of crawled page
//     var reviews = await Review.find({movie_imdb_id: movieId}).sort({created_at: -1}).exec();
//     var lastestReview = reviews[0];
//     var lastestCrawlTimestamp = lastestReview ? lastestReview.created_at : '01/01/1970';
//     var crawledPage = Math.ceil(reviews.length / 25);

//     console.log(lastestCrawlTimestamp, reviews.length, crawledPage);

//     var ph = await phantom.create();
//     var page = await ph.createPage();

//     await page.open(`https://www.imdb.com/title/${movieId}/reviews?sort=submissionDate&dir=desc&ratingFilter=0`).then(async status => {
//         await page.evaluate(function (crawledPage) {
//             var totalReviews = parseInt($(".lister .header span").first().text().split(" ")[0].replace('.', '').replace(',', ''));
//             // var totalPages = Math.ceil(totalReviews / 25);
//             // var pageToCrawl = crawledPage ? (totalPages - crawledPage + 1) : totalPages;
//             var pageToCrawl = Math.ceil(totalReviews / 25);

//             if (pageToCrawl > 1) {
//                 var temp = pageToCrawl;
//                 var i = 0;

//                 (function loopClick(pages) {
//                     document.getElementById('load-more-trigger').click();
//                     i++;

//                     setTimeout(function () {
//                         if (--pages) {
//                             loopClick(pages);
//                         }
//                     }, 3000);
//                 })(temp);
//             }

//             return pageToCrawl;
//         }, crawledPage).then(function (pageToCrawl) {
//             console.log(pageToCrawl)
//             if(pageToCrawl > 0) {
//                 setTimeout(async function () {
//                     await page.evaluate(function (lastestCrawlTimestamp) {
//                         var reviews = [];

//                         $('.imdb-user-review').each(function (index, element) {
//                             var reviewDate = $($(element).find('.review-date')[0]).text();
//                             if(new Date(reviewDate) > new Date(lastestCrawlTimestamp)) {
//                                 reviews.push({
//                                     user_id: $($($(element).find('.display-name-link')[0]).find('a')[0]).attr('href').substr(6, 11),
//                                     rating: $($($(element).find('.rating-other-user-rating')[0]).find('span')[0]).text() || 0,
//                                     content: $($(element).find('.title')[0]).text()
//                                 })
//                             }
//                         });

//                         return reviews;
//                     }, lastestCrawlTimestamp).then(function (reviews) {
//                         console.log(reviews.length);
//                         if(reviews.length) {
//                             reviews.forEach(review => {
//                                 review.movie_imdb_id = movieId;
//                             });
//                             // fs.writeFileSync(`./data/reviews/reviews_${movieId}.json`, JSON.stringify(reviews), (err, res) => {
//                             //     console.log(err);
//                             //     console.log(res);
//                             // });
//                             Review.insertMany(reviews, {ordered: true}, (err, res) => {
//                                 if(err) errorLogger.error(err);
//                                 console.log('===================== Done');
//                             })
//                         }
//                     })
//                 }, 3500 * pageToCrawl);
//             }

//             // ph.exit();
//             // return { status: 1 }
//         }).catch(function (err) {
//             errorLogger.error(err);
//         })
//     }).catch(function (err) {
//         errorLogger.error(err);
//     });
// }

/**
 * Crawl reviews of specific movie
 */
exports.crawlReviews = async (movieId) => {
    try {
        const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox']});
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
            var userReviews = await page.evaluate((lastestCrawlTimestamp) => {
                const $ = window.$;

                var reviews = [];

                $('.imdb-user-review').each(function (index, element) {
                    var reviewDate = $($(element).find('.review-date')[0]).text();
                    if (new Date(reviewDate) > new Date(lastestCrawlTimestamp)) {
                        reviews.push({
                            user_id: $($($(element).find('.display-name-link')[0]).find('a')[0]).attr('href').substr(6, 11),
                            rating: $($($(element).find('.rating-other-user-rating')[0]).find('span')[0]).text() || 0,
                            content: $($(element).find('.title')[0]).text()
                        })
                    }
                });

                return reviews;
            })

            await browser.close();
            console.log(`Crawl ${movieId} done!`);
        }, 2700 * pageToCrawl);
    } catch (err) {
        console.log(err);
    }

}