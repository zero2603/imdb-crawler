const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reviewModel = new Schema({
    user_id: {type: String, required: true},
    movie_imdb_id: {type: String, required: true},
    content: {type: String, required: true},
    rating: {type: Number, required: true},
    created_at: {type: Date, default: Date.now}
});

module.exports = mongoose.model('Review', reviewModel);