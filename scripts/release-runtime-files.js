// One allowlist shared by the builder and both unpacked/ZIP artifact checks.
const packagedScripts = Object.freeze([
  "database-schema.js", "management-schema.js", "card-tracking-schema.js", "scout-schema.js",
  "storage-paths.js", "init-db.js",
  "generate-home-thumbnails.js", "prepare-local.js"
]);

module.exports = { packagedScripts };
