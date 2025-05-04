const mongodb = require('mongodb');
const mongoose = require('mongoose');
require('dotenv').config()

mongoose.Promise = global.Promise;
let dbName = "messageboardDB";
console.log("Full Connection String:", process.env.DB);
mongoose.connect(process.env.DB, {

});
let db = mongoose.connection;
db.on('error', err => { console.error(err) });
db.once('open', () => {
    console.log(`Connected to Database ${dbName}`)
});
process.on('SIGINT', () => {
    db.close(() => {
        console.log(`Closing connection to ${dbName}`);
        process.exit(0);
    });
});

module.exports = db;