const packageJson = require("../package.json");
const { resolveWindowsSigning } = require("./windows-signing");

const signing = resolveWindowsSigning(process.env);
process.stdout.write(`Windows signing mode: ${signing.description}\n`);

module.exports = {
  ...packageJson.build,
  win: {
    ...packageJson.build.win,
    ...signing.winOptions
  }
};
