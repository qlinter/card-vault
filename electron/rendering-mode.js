function shouldUseSoftwareRendering({ env = process.env, argv = process.argv } = {}) {
  const environmentValue = String(env.CARD_VAULT_DISABLE_GPU ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(environmentValue)
    || argv.includes("--disable-gpu")
    || argv.includes("--software-rendering");
}

module.exports = { shouldUseSoftwareRendering };
