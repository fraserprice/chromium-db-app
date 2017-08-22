/*
 * Strategy for finding VCCs:
 * - Scrape "Chrome Releases" to find all CVEs, and extract bug numbers they refer to (#getVulnBugIDs)
 * - Scrape comments of each bug page to find links to code review, which should contain links to fixing commit,
 *   which we extract (#getFixingCommits)
 * - From here can look into copying VCCFinder's code for getting VCCs from fixing commits.
 */

const fetch = require('isomorphic-fetch');

const STABLE_UPDATES_URL = 'https://chromereleases.googleblog.com/search/label/Stable%20updates';

// Find all occurrences of strings sandwiched between two other strings in a given string.
const findSandwichedStrings = (str, sandwichStart, sandwichEnd) => {
  const regex = new RegExp(sandwichStart + '(.*?)' + sandwichEnd, 'gm');
  let match = str.match(regex);
  sandwichStart = sandwichStart.replace(/\\/g, '');
  sandwichEnd = sandwichEnd.replace(/\\/g, '');
  return match === null ? [] : match.map(match => match.replace(sandwichStart, '').replace(sandwichEnd, ''));;
};

class VccUtils {
  constructor() {
    this.getVulnBugIDs = (use_cached, callback) => {
      const fetchIds = (pageUrl, ids, callback) => {
        fetch(pageUrl, {
          method: 'GET'
        }).then(response => response.text()
        ).then(pageBody => {
          let ids_key1 = findSandwichedStrings(pageBody, '\\[</span><a href="https://crbug\\.com/', '"');
          let ids_key2 = findSandwichedStrings(pageBody, '\\[</span><a href="https://code\.google\\.com/p/chromium/issues/detail\\?id=', '"');
          ids = ids.concat(ids_key1.concat(ids_key2));
          let nextPage = findSandwichedStrings(pageBody, 'blog-pager-older-link\' href=\'', '\'');
          if(nextPage.length === 0) {
            return callback(false, Array.from(new Set(ids)));
          } else {
            return fetchIds(nextPage[0], ids, callback);
          }
        }).catch(err => {
          console.log(err);
          return callback(err);
        });
      };

      fetchIds(STABLE_UPDATES_URL, [], callback);
    };

    this.getFixingCommit = (bug_id, use_cached) => {

    };

    this.getFixingCommits = (bug_ids, use_cached) => {

    }
  }
}

module.exports = new VccUtils();