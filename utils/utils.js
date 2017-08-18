class Utils {
  encodeFieldName(name) {
    return name === null ? null : name.replace(/\./g, '_STOP_')
  }

  decodeFieldName(name) {
    return name === null ? null : name.replace(/_STOP_/g, '.')
  }

  getChildren(treemap, path) {
    let children = [];
    if(treemap !== undefined) {
      treemap.forEach(node => {
        if (node[1] === path) {
          children.push(node);
        }
      });
      return children;
    }
    return [];
  }

  /* Convert treemap into traversable tree. Option to save to mongodb for given query.
   * Requires file changes as tree contains security bugs + all bugs info; note file changes keys must be changed.
   * Done to massively speed up finding children to return subtree.
   * Tree is in format:
   * {
   *    query: String,
   *    .
   *    .
   *    .
   *    nodePath :
   *    {
   *      node : nodePath,
   *      parent : parentPath,
   *      children : [childPaths],
   *      size : size,
   *      bugs : bugs,
   *      security_bugs : security_bugs,
   *      query : query
   *    }
   * }
   * Note that full stops are replaced with '_STOP_' in all paths (field, children, parent) as Mongo does not support
   * fields with full stops.
   *
   * Tree is cached in mongodb as one document per node; getTree can be used to build tree from cache.
  */
  treeFormat(treemap, fileChanges, cacheResult, cache, query) {
    let tree = {};
    treemap.forEach(node => {
      const path = node[0];
      const parentPath = node[1];
      const size = node[2];
      const children = this.getChildren(treemap, path).map(childNode => this.encodeFieldName(childNode[0]));
      const fileChangesKey = this.encodeFieldName(path.substring(2));
      const changes = fileChanges[fileChangesKey];
      const isDirectory = changes == null;
      const bugs = isDirectory ? 0 : changes[0];
      const security_bugs = isDirectory ? 0 : changes[1];
      tree[this.encodeFieldName(path)] = {
        parent : this.encodeFieldName(parentPath),
        children : children,
        size : size,
        bugs : bugs,
        security_bugs : security_bugs,
        query : query
      }
    });
    if(cacheResult) {
      let bulk = cache.collection.initializeOrderedBulkOp();
      for(const path in tree) {
        if(tree.hasOwnProperty(path)) {
          let node = tree[path];
          node.node = path;
          console.log(node);
          bulk.find({"node" : path, "query" : query}).upsert().updateOne(node);
        }
      }
      bulk.execute(err => {
        if(err) {
          console.log('Could not save. Err:');
          console.log(err);
        } else {
          console.log('Saved!');
        }
      });
    }
    return tree;
  }

  //Convert traversible treemap into google treemap format
  googleTreemapFormat(tree, isSecurity) {
    let treemap = [];
    for(const path in tree) {
      if(tree.hasOwnProperty(path)) {
        const node = tree[path];
        console.log(path);
        treemap.push([
          this.decodeFieldName(path),
          this.decodeFieldName(node.parent),
          node.size,
          isSecurity ? node.security_bugs : node.bugs
        ]);
      }
    }
    return treemap;
  }

  // Builds tree for given query from given cache documents
  getTree(query, cache, callback) {
    let tree = {};
    cache.find({'node.query' : query}, (err, nodes) => {
      if(err) {
        return callback(err);
      }
      nodes.forEach(nodeDoc => {
        tree[nodeDoc.node.node] = nodeDoc.node;
      });
      return callback(null, tree);
    });
  }

  // Return subtree in traversable tree format for given depth (infinte depth if 0), rooted at rootPath.
  // Note that rootPath should contain '.' rather than '_STOP_'.
  getSubtree(tree, rootPath, depth) {
    rootPath = this.encodeFieldName(rootPath);
    let subtree = {};
    subtree[rootPath] = tree[rootPath];
    let children = tree[rootPath].children;
    if(depth === 0) {
      while(true) {
        children.forEach(childPath => subtree[childPath] = tree[childPath]);
        let newChildren = [];
        children.forEach(child => newChildren = newChildren.concat(tree[child].children));
        if(newChildren.length === 0) {
          break;
        }
        children = newChildren;
      }
    } else {
      for(let i = 0; i < depth; i++) {
        children.forEach(childPath => subtree[childPath] = tree[childPath]);
        let newChildren = [];
        children.forEach(child => newChildren = newChildren.concat(tree[child].children));
        children = newChildren;
      }
    }
    return subtree;
  }
}

module.exports = new Utils();