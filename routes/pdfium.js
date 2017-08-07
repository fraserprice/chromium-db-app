const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const config = require('../config/config')();

/*
  All data used by these endpoints are cached in mongodb.
 */

const schema = new mongoose.Schema(
  {
    query: String,
    change_numbers: [Number],
    file_changes: {},
    treemap: [[String, String, Number, Number]],
    security_treemap: [[String, String, Number, Number]]
  });

const pdfium_cache = mongoose.model('Pdfium', schema, "pdfium");

const getQueryItem = (query, item, res) => {
  pdfium_cache.findOne({'query': query}, (err, doc) => {
    if(err) {
      console.log("Could not connect to database");
      return res.sendStatus(403);
    } else {
      return res.json(doc[item])
    }
  });
};

router.get('/', function(req, res) {
  res.render('index');
});

//Get change numbers for given query
router.get('/change_numbers/:query', function(req, res) {
  const query = req.params.query;
  return getQueryItem(query, 'change_numbers', res)
});

//Get all file changes for given query
router.get('/file_changes/:query', function(req, res) {
  const query = req.params.query;
  return getQueryItem(query, 'file_changes', res)
});

//Get treemap for given query
router.get('/treemap/:query', function(req, res) {
  const query = req.params.query;
  return getQueryItem(query, 'treemap', res)
});

//Get security treemap for given query
router.get('/security_treemap/:query', function(req, res) {
  const query = req.params.query;
  return getQueryItem(query, 'security_treemap', res)
});

module.exports = router;
