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

const returnQueryItem = (query, item, res) => {
  pdfium_cache.findOne({'query': query}, (err, doc) => {
    if(err) {
      console.log("Could not connect to database");
      return res.sendStatus(403);
    }
    return res.json(doc[item])
  });
};

const returnTreemap = (bug_type, req, res) => {
  const query = req.params.query;
  const rootPath = req.params.root_path;
  const depth = parseInt(req.params.depth);
  const normalise = req.params.normalise === 'true';
  utils.getTree(query, pdfium_tree, (err, tree) => {
    if(err) {
      return res.sendStatus(500);
    } else {
      const subtree = utils.getSubtree(tree, rootPath, depth);
      return res.json(utils.googleTreemapFormat(subtree, bug_type, normalise));
    }
  });
};

router.get('/', (req, res) => {
  res.render('index');
});

// Get traversable tree for given query
router.get('/tree/:query/:root_path/:depth', (req, res) => {
  const query = req.params.query;
  const rootPath = req.params.root_path;
  const depth = parseInt(req.params.depth);
  utils.getTree(query, pdfium_tree, (err, tree) => {
    if(err) {
      return res.sendStatus(500);
    }
    if(depth > 0) {
      tree = utils.getSubtree(tree, rootPath, depth);
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

// Get change numbers for given query
router.get('/change_numbers/:query', function(req, res) {
  const query = req.params.query;
  return returnQueryItem(query, 'change_numbers', res)
});

// Get all file changes for given query
router.get('/file_changes/:query', function(req, res) {
  const query = req.params.query;
  return returnQueryItem(query, 'file_changes', res)
});

// Get treemap for given query, rooted at given file/folder, for given depth
router.get('/treemap/:query/:root_path/:depth/:normalise', (req, res) => {
  return returnTreemap('bugs', req, res);
});

// Get security treemap for given query, rooted at given file/folder, for given depth
router.get('/security_treemap/:query/:root_path/:depth/:normalise', (req, res) => {
  return returnTreemap('security_bugs', req, res);
});

// Get ratio of sec bugs : bugs for given query, rooted at given file/folder, for given depth (0 => infinite),
// with bool for normalisation
router.get('/security_ratio_treemap/:query/:root_path/:depth/:normalise', (req, res) => {
  return returnTreemap('security_bug_ratio', req, res);
});

module.exports = router;
