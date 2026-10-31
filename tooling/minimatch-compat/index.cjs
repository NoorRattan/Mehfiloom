// Older ESLint plugins call require("minimatch") directly; modern consumers use
// its named exports. Pattern evaluation always uses patched upstream code.
const upstream = require("minimatch-secure");
module.exports = Object.assign(upstream.minimatch, upstream, {
  // eslint-plugin-import only calls .test() on makeRe results. Version 11 no
  // longer builds regexes, so retain that narrow contract with its safe matcher.
  makeRe(pattern, options) {
    const matcher = new upstream.Minimatch(pattern, options);
    return { test: (value) => matcher.match(value) };
  },
});
