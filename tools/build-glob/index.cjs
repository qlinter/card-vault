// Used only by node-gyp for Windows solution files and typescript-estree for project paths.
const { glob, globSync, hasMagic } = require("glob");

function fileOptions({ cwd, ignore, expandDirectories } = {}) {
  if (expandDirectories !== false) throw new Error("Build file searches require expandDirectories: false");
  return { cwd, ignore, nodir: true, posix: true };
}

module.exports = {
  glob: (pattern, options) => glob(pattern, fileOptions(options)),
  globSync: (pattern, options) => globSync(pattern, fileOptions(options)),
  isDynamicPattern: pattern => hasMagic(pattern, { magicalBraces: true })
};
