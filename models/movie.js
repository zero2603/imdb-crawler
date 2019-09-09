const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const movieModel = new Schema({
    imdb_id: {type: String, required: true},
    title: {type: String, required: true},
    avgRate: {type: Number, required: false, default: 0},
    genres: [{type: String}],
    releaseDate: {type: String},
    created_at: {type: Date, default: Date.now}
});

movieModel.index({ "imdb_id": 1 }, { unique: 1 });

module.exports = mongoose.model('Movie', movieModel);