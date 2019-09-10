var crawler = require('./crawler');
var express = require('express');
var fs = require('fs');
const bodyParser = require('body-parser');
var cron = require('node-cron');
const mongoose = require('mongoose');
var request = require('request-promise');

// models
var Movie = require('./models/movie');
var Review = require('./models/review');

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// connect to db
const uri = "mongodb+srv://root:12345az@cluster0-gakrk.gcp.mongodb.net/test?retryWrites=true&w=majority";
// const uri = "mongodb://localhost:27017/imdb";
mongoose.connect(uri, { useNewUrlParser: true }).then(() => {
    console.log("Connected to Mongo")
}, err => {
    console.log(err);
});

app.get('/', function (req, res) {
    res.send("IMDB Crawler")
});

app.get('/movies', async (req, res) => {
    var currentPage = parseInt(req.query.page) ? parseInt(req.query.page) : 1;

    var movies = await Movie.find({}).sort({releaseDate: 1}).skip(50 * (currentPage - 1)).limit(50);

    res.send({ movies });
});

app.get('/reviews', async (req, res) => {
    var currentPage = parseInt(req.query.page) ? parseInt(req.query.page) : 1;
    var movieId = req.query.id;
    var reviews = await Review.count({ movie_imdb_id: movieId });

    res.send({ reviews });
});

app.get('/crawl/movies', (req, res) => {
    // crawl base years
    var years = ['2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018'];

    years.forEach(year => {
        crawler.crawlMovies(20, `${year}-01-01`, `${year}-12-31`);
    })

    // crawl base month of 2019
    var months = ['01', '02', '03', '04', '05', '06', '07', '08'];

    months.forEach(month => {
        crawler.crawlMovies(1, `2019-${month}-01`, `2019-${month}-31`);
    })

    res.send({ ok: 1 })
});

app.get('/crawl/reviews', async (req, res) => {
    var currentPage = parseInt(req.query.page) ? parseInt(req.query.page) : 1;

    fs.readFile('activity', 'utf8', (err, data) => {
        if (err) res.send(err);

        data = JSON.parse(data);
        if (data.crawledPage < currentPage) {
            fs.writeFileSync('activity', JSON.stringify({ crawledPage: currentPage }));
        }
    });

    var movies = await Movie.find({}).sort({releaseDate: -1}).skip(15 * (currentPage - 1)).limit(15);
    movies.map(movie => {
        crawler.crawlReviews(movie.imdb_id);
    });

    res.send({ ok: 1 });
});

app.get('/log/errors', (req, res) => {
    fs.readFile("./error.log", "utf8", function (err, data) {
        if (err) throw err;

        data = data.toString();

        res.send('<pre>' + data + '</pre>');
    });
});

app.get('/log/info', (req, res) => {
    fs.readFile("./info.log", "utf8", function (err, data) {
        if (err) throw err;

        data = data.toString();

        res.send('<pre>' + data + '</pre>');
    });
});

app.get('/log/activity', (req, res) => {
    fs.readFile("./activity", "utf8", function (err, data) {
        if (err) throw err;

        data = data.toString();

        res.send('<pre>' + data + '</pre>');
    });
});

app.get('/test', (req, res) => {
    res.send(crawler.crawlReviews('tt2935510'));
})


cron.schedule('*/10 * * * *', () => {
    fs.readFile("./activity", "utf8", function (err, data) {
        if (err) throw err;

        data = JSON.parse(data);

        request(`https://gentle-sands-96033.herokuapp.com/crawl/reviews?page=${data.crawledPage + 1}`);
    });
});


app.listen(process.env.PORT || 3000, () => console.log('App is running!'));
