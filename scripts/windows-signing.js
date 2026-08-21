const azureFields = {
  endpoint: "CARD_VAULT_AZURE_SIGN_ENDPOINT",
  codeSigningAccountName: "CARD_VAULT_AZURE_SIGN_ACCOUNT",
  certificateProfileName: "CARD_VAULT_AZURE_SIGN_PROFILE",
  publisherName: "CARD_VAULT_AZURE_SIGN_PUBLISHER"
};

const azureCredentialFields = ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET"];

function value(env, name) {
  return typeof env[name] === "string" ? env[name].trim() : "";
}

function resolveWindowsSigning(env = process.env) {
  const azureValues = Object.fromEntries(
    Object.entries(azureFields).map(([field, name]) => [field, value(env, name)])
  );
  const configuredAzureFields = Object.values(azureValues).filter(Boolean).length;
  if (configuredAzureFields > 0) {
    const missingConfig = Object.entries(azureValues).filter(([, fieldValue]) => !fieldValue).map(([field]) => azureFields[field]);
    const missingCredentials = azureCredentialFields.filter((name) => !value(env, name));
    const missing = [...missingConfig, ...missingCredentials];
    if (missing.length > 0) {
      throw new Error(`Microsoft Artifact Signing configuration is incomplete. Missing: ${missing.join(", ")}`);
    }
    return {
      mode: "azure",
      description: `Microsoft Artifact Signing (${azureValues.publisherName})`,
      winOptions: {
        forceCodeSigning: true,
        signAndEditExecutable: true,
        azureSignOptions: {
          ...azureValues,
          fileDigest: "SHA256",
          timestampDigest: "SHA256",
          timestampRfc3161: "http://timestamp.acs.microsoft.com"
        }
      }
    };
  }

  const certificateLink = value(env, "WIN_CSC_LINK") || value(env, "CSC_LINK");
  const certificateSubjectName = value(env, "CARD_VAULT_SIGNING_SUBJECT");
  const certificateSha1 = value(env, "CARD_VAULT_SIGNING_SHA1");
  if (!certificateLink && !certificateSubjectName && !certificateSha1) {
    return {
      mode: "unsigned",
      description: "unsigned development release",
      winOptions: {
        forceCodeSigning: false,
        signAndEditExecutable: true,
        signExecutable: false
      }
    };
  }

  const signtoolOptions = {
    signingHashAlgorithms: ["sha256"],
    rfc3161TimeStampServer: "http://timestamp.digicert.com"
  };
  if (certificateSubjectName) signtoolOptions.certificateSubjectName = certificateSubjectName;
  if (certificateSha1) signtoolOptions.certificateSha1 = certificateSha1;

  return {
    mode: "signtool",
    description: certificateSubjectName
      ? `Windows certificate store (${certificateSubjectName})`
      : certificateSha1
        ? `Windows certificate store (${certificateSha1})`
        : "PFX code-signing certificate",
    winOptions: {
      forceCodeSigning: true,
      signAndEditExecutable: true,
      signtoolOptions
    }
  };
}

module.exports = { resolveWindowsSigning };
