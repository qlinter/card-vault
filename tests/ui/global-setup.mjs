import uiTestServer from "../../scripts/start-ui-test-server.js";

export default async function globalSetup() {
  const runtime = await uiTestServer.startUiTestServer();
  return async () => runtime.close();
}
