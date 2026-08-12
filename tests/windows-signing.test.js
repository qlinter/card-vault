const assert = require("node:assert/strict");
const test = require("node:test");
const { resolveWindowsSigning } = require("../scripts/windows-signing");

test("Windows release refuses to package without signing credentials", () => {
  assert.throws(() => resolveWindowsSigning({}), /code-signing credentials are required/);
});

test("PFX signing uses SHA-256 and RFC 3161 timestamps", () => {
  const signing = resolveWindowsSigning({ WIN_CSC_LINK: "C:\\secrets\\card-vault.pfx" });
  assert.equal(signing.mode, "signtool");
  assert.equal(signing.winOptions.forceCodeSigning, true);
  assert.deepEqual(signing.winOptions.signtoolOptions.signingHashAlgorithms, ["sha256"]);
  assert.equal(signing.winOptions.signtoolOptions.rfc3161TimeStampServer, "http://timestamp.digicert.com");
});

test("certificate-store signing can select an EV identity", () => {
  const signing = resolveWindowsSigning({ CARD_VAULT_SIGNING_SUBJECT: "QL Card Vault" });
  assert.equal(signing.winOptions.signtoolOptions.certificateSubjectName, "QL Card Vault");
});

test("Artifact Signing requires complete account and Entra credentials", () => {
  assert.throws(
    () => resolveWindowsSigning({ CARD_VAULT_AZURE_SIGN_ENDPOINT: "https://example.codesigning.azure.net" }),
    /configuration is incomplete/
  );
  const signing = resolveWindowsSigning({
    CARD_VAULT_AZURE_SIGN_ENDPOINT: "https://example.codesigning.azure.net",
    CARD_VAULT_AZURE_SIGN_ACCOUNT: "card-vault-signing",
    CARD_VAULT_AZURE_SIGN_PROFILE: "public-trust",
    CARD_VAULT_AZURE_SIGN_PUBLISHER: "QL Card Vault",
    AZURE_TENANT_ID: "tenant",
    AZURE_CLIENT_ID: "client",
    AZURE_CLIENT_SECRET: "secret"
  });
  assert.equal(signing.mode, "azure");
  assert.equal(signing.winOptions.azureSignOptions.fileDigest, "SHA256");
  assert.equal(signing.winOptions.azureSignOptions.timestampDigest, "SHA256");
});
