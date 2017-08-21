class Utils {
  constructor() {

    this.encodeFieldName = (name) => {
      return name === null ? null : name.replace(/\./g, '_STOP_')
    };

    this.decodeFieldName = (name) => {
      return name === null ? null : name.replace(/_STOP_/g, '.')
    };

    this.getChildren = (treemap, path) => {
      let children = [];
      if (treemap !== undefined) {
        treemap.forEach(node => {
          if (node[1] === path) {
            children.push(node);
          }
        });
        return children;
      }
      return [];
    };

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
     *      security_bug_ratio : security_bug_ratio,
     *      query : query
     *    }
     * }
     * Note that full stops are replaced with '_STOP_' in all paths (field, children, parent) as Mongo does not support
     * fields with full stops.
     *
     * Tree is cached in mongodb as one document per node; getTree can be used to build tree from cache.
     */
    this.treeFormat = (treemap, fileChanges, cacheResult, cache, query) => {
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
        const security_bug_ratio = bugs === 0 ? 0 : parseFloat(security_bugs) / parseFloat(bugs);

        tree[this.encodeFieldName(path)] = {
          parent: this.encodeFieldName(parentPath),
          children: children,
          size: size,
          bugs: {
            bugs: bugs,
            security_bugs: security_bugs,
            security_bug_ratio: security_bug_ratio,
          },
          query: query
        }
      });
      if (cacheResult) {
        let bulk = cache.collection.initializeOrderedBulkOp();
        for (const path in tree) {
          if (tree.hasOwnProperty(path)) {
            let node = tree[path];
            node.node = path;
            console.log(node);
            bulk.find({"node": path, "query": query}).upsert().updateOne(node);
          }
        }
        bulk.execute(err => {
          if (err) {
            console.log('Could not save. Err:');
            console.log(err);
          } else {
            console.log('Saved!');
          }
        });
      }
      return tree;
    };

    // Convert traversible treemap into google treemap format
    // bug_type can be bugs, security_bugs or security_bug_ratio
    this.googleTreemapFormat = (tree, rootPath, bugType, normalise) => {
      let treemap = [];
      for (const path in tree) {
        if (tree.hasOwnProperty(path)) {
          const node = tree[path];
          const treemapNode = [
            this.decodeFieldName(path),
            this.decodeFieldName(path) === rootPath ? null : this.decodeFieldName(node.parent),
            node.size,
            node.bugs[bugType]
          ];
          treemap.push(treemapNode);
        }
      }
      treemap = normalise ? this.normaliseByFileSize(treemap) : treemap;
      treemap.unshift(["Directory/File", "Parent Directory", "Size", "Bugs"]);
      return treemap
    };

    // Builds tree for given query from given cache documents
    this.getTree = (query, cache, callback) => {
      let tree = {};
      cache.find({'query': query}, {_id: 0}, (err, nodes) => {
        if (err) {
          return callback(err);
        }
        nodes.forEach(nodeDoc => {
          tree[nodeDoc.node] = nodeDoc.toJSON();
          tree[nodeDoc.node].size = parseInt(tree[nodeDoc.node].size)
        });
        return callback(null, tree);
      });
    };

    /* Return subtree in traversable tree format for given depth (infinte depth if 0), rooted at rootPath.
     * Note that rootPath should contain '.' rather than '_STOP_'.
     * Averages bugs over all child files recursively for bug numbers.
     */
    this.getSubtree = (query, cache, rootPath, depth, callback) => {
      console.log(rootPath);
      let children = [this.encodeFieldName(rootPath)];

      let findSubtree = (query, children, subtree, remainingDepth, callback) => {
        if(remainingDepth === 0 || children.length === 0) {
          return callback(null, subtree);
        }
        cache.find({"query" : query, "node" : {$in: children}}, {_id: 0}, (err, childNodes) => {
          if(err) {
            return callback(err);
          }
          children = [];
          childNodes.forEach(nodeDoc => {
            let node = nodeDoc.toJSON();
            subtree[node.node] = node;
            subtree[node.node].size = parseInt(subtree[node.node].size);
            children = children.concat(node.children);
          });
          findSubtree(query, children, subtree, remainingDepth - 1, callback);
        });
      };

      let subtree = {};
      if (depth === 0) {
        if(rootPath === '~') {
          this.getTree(query, cache, callback);
        } else {
          findSubtree(query, children, subtree, -1, callback);
        }
      } else {
        findSubtree(query, children, subtree, depth, callback);
        // Average bugs for all children in the case of leaf nodes:
        //TODO: fix
       // children.forEach(childPath => {
       //   let averageBugValues = this.averageBugValues(tree, childPath);
       //   for (const bug_type in subtree[childPath].bugs) {
       //     if (subtree[childPath].bugs.hasOwnProperty(bug_type)) {
       //       subtree[childPath].bugs[bug_type] = averageBugValues[bug_type]
       //     }
       //   }
       // });
      }
    };

    //TODO: FIX ME
    // Averages bug values of all children of given node recursively
    this.averageBugValues = (tree, nodePath) => {
      const sums = this.getBugSums(tree, [nodePath]);
      let averageBugs = {};
      for (const bug_type in sums.bugSums) {
        if (sums.bugSums.hasOwnProperty(bug_type)) {
          averageBugs[bug_type] = parseFloat(sums.bugSums[bug_type]) / parseFloat(sums.fileSum)
        }
      }
      return averageBugs;
    };

    /* Retreives count of files + bugs for all children recursively.
     * fileSum = number of files seen (not including dirs), currentSums = current sum of bugs seen in format
     * {bugSum : ..., seurityBugSum : ...}
     */
    this.getBugSums = (tree, children) => {

      let fileSum = 0;
      let bugSums = {};
      for (const bug_type in tree['~'].bugs) {
        if (tree['~'].bugs.hasOwnProperty(bug_type)) {
          bugSums[bug_type] = 0
        }
      }

      children.forEach(childPath => {
        const childNode = tree[childPath];
        if (childNode.children.length === 0) {
          fileSum++;
          for (const bug_type in bugSums) {
            if (bugSums.hasOwnProperty(bug_type)) {
              bugSums[bug_type] += childNode.bugs[bug_type]
            }
          }
        } else {
          const childrenSum = this.getBugSums(tree, childNode.children);
          fileSum += childrenSum.fileSum;
          for (const bug_type in bugSums) {
            if (bugSums.hasOwnProperty(bug_type)) {
              bugSums[bug_type] += childrenSum.bugSums[bug_type]
            }
          }
        }
      });

      return {
        fileSum: fileSum,
        bugSums: bugSums
      }
    };

    // Normalise treemap bugs by file size. Sqrt helps to remove anomalies.
    this.normaliseByFileSize = (treemap) => {
      return treemap.map(node => {
        if (!isNaN(parseInt(node[3]))) {
          const divisor = node[2] === 0 ? 1 : parseFloat(Math.sqrt(node[2]));
          const normalisedValue = parseFloat(node[3]) / divisor;
          console.log(node[0]);
          console.log(node[3]);
          console.log(normalisedValue);
          return [node[0], node[1], node[2], normalisedValue]
        }
      });
    };
  }

}

module.exports = new Utils();