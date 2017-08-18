const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const config = require('../config/config');
const utils = require('../utils/utils');

/*
  All data used by these endpoints are cached in mongodb.
 */

const schema = new mongoose.Schema(
  {
    query: String,
    change_numbers: [Number],
    file_changes: {},
    tree: {},
    treemap: [[String, String, Number, Number]],
    security_treemap: [[String, String, Number, Number]]
  });

const pdfium_cache = mongoose.model('Pdfium', schema, "pdfium");
const pdfium_tree = mongoose.model('pdfium_tree', new mongoose.Schema({node: {}}), 'pdfium_tree');

const getQueryItem = (query, item, callback) => {
  pdfium_cache.findOne({'query': query}, (err, doc) => {
    if(err) {
      console.log("Could not connect to database");
      return callback(null);
    } else {
      return callback(doc[item]);
    }
  });
};

const returnQueryItem = (query, item, res) => {
  pdfium_cache.findOne({'query': query}, (err, doc) => {
    if(err) {
      console.log("Could not connect to database");
      return res.sendStatus(403);
    }
    return res.json(doc[item])
  });
};

router.get('/', (req, res) => {
  res.render('index');
});

// Get traversable tree for given query
router.get('/tree/:query', (req, res) => {
  const query = req.params.query;
  utils.getTree(query, pdfium_tree, (err, tree) => {
    if(err) {
      return res.sendStatus(500);
    }
    return res.json(tree);
  });
});

// Update traversable tree from file changes + treemap
router.get('/update_tree/:query', (req, res) => {
  const query = req.params.query;
  pdfium_cache.findOne({'query' : query}, (err, doc) => {
    if(err) {
      console.log('Could not find');
      return res.sendStatus(500);
    }
    return res.json(utils.treeFormat(doc.treemap, doc.file_changes, true, pdfium_tree, query, false));
  });
});

//Get change numbers for given query
router.get('/change_numbers/:query', function(req, res) {
  const query = req.params.query;
  return returnQueryItem(query, 'change_numbers', res)
});

//Get all file changes for given query
router.get('/file_changes/:query', function(req, res) {
  const query = req.params.query;
  return returnQueryItem(query, 'file_changes', res)
});

//Get treemap for given query
router.get('/treemap/:query', function(req, res) {
  const query = req.params.query;
  return returnQueryItem(query, 'treemap', res)
});

//Get security treemap for given query
router.get('/security_treemap/:query', function(req, res) {
  const query = req.params.query;
  return returnQueryItem(query, 'security_treemap', res)
});

//Get treemap for given query, rooted at given file/folder, for given depth
router.get('/subtreemap/:query/:root_path/:depth', (req, res) => {
  const query = req.params.query;
  const rootPath = req.params.root_path;
  const depth = parseInt(req.params.depth);
  getQueryItem(query, 'tree', tree => {
    if(tree !== null) {
      const subtree = utils.getSubtree(tree, rootPath, depth);
      return res.json(utils.googleTreemapFormat(subtree, false));
    } else {
      return res.sendStatus(500);
    }
  });
});

//Get security treemap for given query, rooted at given file/folder, for given depth
router.get('/security_subtreemap/:query/:root_path/:depth', (req, res) => {
  const query = req.params.query;
  const rootPath = req.params.root_path;
  const depth = parseInt(req.params.depth);
  getQueryItem(query, 'tree', tree => {
    if(tree !== null) {
      const subtree = utils.getSubtree(tree, rootPath, depth);
      return res.json(utils.googleTreemapFormat(subtree, true));
    } else {
      return res.sendStatus(500);
    }
  });
});

module.exports = router;
