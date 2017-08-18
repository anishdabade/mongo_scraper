var express = require("express");
var router = express.Router();
var Article = require("../models/article.js");
var Comment = require("../models/comment.js");
var bodyParser = require("body-parser");
var methodOverride = require("method-override");
var cheerio = require("cheerio");
var mongoose = require("mongoose");
var deepPopulate = require('mongoose-deep-populate')(mongoose);
var request = require("request");

// Use native promises
mongoose.Promise = global.Promise;

mongoose.connect("mongodb://localhost/mongo_scraper");

var db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
 
    console.log('We are connected to db!');
});

router.get("/", function(req, res) {
    res.render("index");
})

// Saved articles
router.get("/saved", function(req, res) {
    var query = Article.find({});

    query.exec(function(err, articles) {
        if (err) {
            return handleError(err);
        } else {

            res.render("saved", { articles: articles });
        }
    });
});

//Get all comments
router.get("/comments", function(req, res) {
    var query = Comment.find({});

    query.exec(function(err, comments) {
        if (err) {
            return handleError(err);

        } else {
            res.render('saved', { comments: comments });
        }
    })
})

//Find comment by id
router.get("/comments/:id", function(req, res) {

    Comment.findOne({ '_id': req.params.id })

    .exec(function(err, comment) {

        if (err) {
            console.log(err);
        } else {

            res.json(comment);

        }
    });
})

// Scrape data from one site and place it into the mongo db
router.get("/scraped", function(req, res) {

    
    request("https://www.nytimes.com/", function(error, response, html) {
        // Load the html body from request into cheerio

        var $ = cheerio.load(html);
        var result = [];

        $("article h2").each(function(i, element) {
            var title = $(this).children("a").text();
            var link = $(this).children("a").attr("href");

            result.push({
                     title: title,
                     link: link
            })
        });

        res.render("index", { articles: result });
    });

});

//allows the user to save scraped articles into the db
router.post("/", function(req, res) {

    var art = new Article({
        title: req.body.title,
        link: req.body.link
    });

    art.save(function(err, art) {
        // If there's an error during this query
        if (err) {
            // Log the error
            return console.log(err);
        }
        // Otherwise,
        else {
            //log results
        }
    });
    //this brings the user back to the scraped results (not root page) so they can browse and save more
    res.redirect("/scraped");

})

//this route is called by app.js. Grabs all comments in the comment array for the specified article
router.get('/populated/:id', function(req, res) {

    Article.find({ '_id': req.params.id })

    .populate('comment')

    .exec(function(err, result) {

        if (err) {
            console.log(err);
        } else {

            res.json(result);
        }
    });

});


// add comment and push to specified article...
router.post('/articles/:id', function(req, res) {
    // create a new comment and pass the req.body to the entry.
    var comment = new Comment({
        username: req.body.username,
        body: req.body.body
    });


    comment.save(function(err, result) {
        // log any errors
        if (err) {
            console.log(err);
        } else {

            //updates the article's comments array so that the new comment is included in results
            Article.findOneAndUpdate({ '_id': req.body.id }, { $push: { 'comment': result._id } }, { new: true }, function(err, result) {
                // log any errors
                if (err) {
                    console.log(err);
                } else {

                    //takes you back to saved results
                    res.redirect('/saved');
                }
            });
        }
    });
});

//Delete route for articles
router.post("/articles/one/:id", function(req, res) {

    Article.findOneAndRemove({ "_id": req.params.id }, { $push: { 'comment': Comment._id } }, function(err) {
        if (err) {
            return handleError(err);
        } else {

            res.redirect('/saved');
        }

    });


});

//Delete route for comments
router.post("/comments/one/:id", function(req, res) {

    Comment.findOneAndRemove({ "_id": req.params.id }, function(err, removed) {
        var removedComment = removed.id;

        //also remove this comment from the corresponding article
        Article.findOneAndUpdate({ 'comment': removedComment }, { $pull: { 'comment': removedComment } }, { new: true }, function(err, removedFromArticle) {
            if (err) {
                throw (err);
            } else {

            }
        })
    });
    res.redirect('/saved');

    console.log('comment removed');
});

module.exports = router;