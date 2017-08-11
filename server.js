/* Showing Mongoose's "Populated" Method
 * =============================================== */

// Dependencies
var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
// Requiring our Note and Article models
var Note = require("./models/Note.js");
var Article = require("./models/Article.js");
// Our scraping tools
var request = require("request");
var cheerio = require("cheerio");

var exphbs = require("express-handlebars");
// Set mongoose to leverage built in JavaScript ES6 Promises
mongoose.Promise = Promise;


// Initialize Express
var app = express();

app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

// Use morgan and body parser with our app
app.use(logger("dev"));
app.use(bodyParser.urlencoded({
  extended: false
}));

// Make public a static dir
app.use(express.static("public"));

// Database configuration with mongoose
mongoose.connect("mongodb://localhost/mongo_scraper");
var db = mongoose.connection;

// Show any mongoose errors
db.on("error", function(error) {
  console.log("Mongoose Error: ", error);
});

// Once logged in to the db through mongoose, log a success message
db.once("open", function() {
  console.log("Mongoose connection successful.");
});


// Routes
// ======
app.get('/', function(req, res) 
{

  // get all the articles
  Article.find({}, function(error, data) 
  {

    // check for error getting articles
    if (error) console.log("error getting articles", error);

    res.render('index', {title: "NewsScraper",articles: data});
  
  });

}); 

// A GET request to scrape the echojs website
app.get("/scrape", function(req, res) {
  // First, we grab the body of the html with request
  request("https://www.nytimes.com/", function(error, response, html) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(html);
    // Now, we grab every h2 within an article tag, and do the following:
    $("article h2").each(function(i, element) {

      // Save an empty result object
      var result = {};

      // Add the text and href of every link, and save them as properties of the result object
      result.title = $(this).children("a").text();
      result.link = $(this).children("a").attr("href");

      // Using our Article model, create a new entry
      // This effectively passes the result object to the entry (and the title and link)
      var entry = new Article(result);

      // Now, save that entry to the db
      entry.save(function(err, doc) {
        // Log any errors
        if (err) {
          console.log(err);
        }
        // Or log the doc
        else {
          console.log(doc);
        }
      });

    });
  });
  
  // Tell the browser that we finished scraping the text
  res.send("Scrape Complete");
});


// This will get the articles we scraped from the mongoDB
app.get("/articles", function(req, res) {
  // Grab every doc in the Articles array
  Article.find({}, function(error, doc) {
    // Log any errors
    if (error) {
      console.log(error);
    }
    // Or send the doc to the browser as a json object
    else {
      res.json(doc);
    }
  });
});




// get notes route
app.get('/note/:id', function(req, res) 
{
  Article.findOne({_id: req.params.id})
    .populate("note")
    .exec(function(error, data) {
      if (error) console.log("error getting notes", error);

      res.send(data.note);
      
    });
});




// post notes route
app.post('/note/:id', function(req, res) 
{

  var newNote = new Note(req.body);

  newNote.save(function(error, data1) 
  {
    Article.findOneAndUpdate(
      {_id: req.params.id},
      {$push: {note: data1._id}},
      {new: true},
      function(err, data2) {
        if (error) console.log("post error", error);
        res.send(data2);
      });
  });
});



// delete note 
app.post('/delete/:id', function(req, res) 
{
  console.log(req.params.id);
  
  Note.findByIdAndRemove({_id: req.params.id}, function(error) 
  {
    if (error) console.log('error deleting note', error);
    res.send();
  });
})


// Listen on port 3000
app.listen(3000, function() {
  console.log("App running on port 3000!");
});