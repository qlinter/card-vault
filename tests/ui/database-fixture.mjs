import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

// Always the disposable harness database, independent of application storage settings.
export const uiDatabasePath = fileURLToPath(new URL('../.ui-test-runtime/data/dev.db', import.meta.url));
export function withUiDatabase(action) {
  const db = new DatabaseSync(uiDatabasePath);
  try { db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON'); return action(db); }
  finally { db.close(); }
}
