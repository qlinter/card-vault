const packageJson = require("../package.json");
const { resolveWindowsSigning } = require("./windows-signing");
const { packagedScripts } = require("./release-runtime-files");

const signing = resolveWindowsSigning(process.env);
process.stdout.write(`Windows signing mode: ${signing.description}\n`);

module.exports = {
  ...packageJson.build,
  files: [...packageJson.build.files, ...packagedScripts.map(name => `scripts/${name}`)],
  win: {
    ...packageJson.build.win,
    ...signing.winOptions
  }
};
