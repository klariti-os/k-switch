const Fastify = require('fastify');
const Database = require('better-sqlite3');

const db = new Database('state.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    focus INTEGER NOT NULL DEFAULT 0
  );
  INSERT OR IGNORE INTO state (id, focus) VALUES (1, 0);
`);

const app = Fastify();

app.post('/state/on', async () => {
  db.prepare('UPDATE state SET focus = 1 WHERE id = 1').run();
  return { focus: 1 };
});

app.post('/state/off', async () => {
  db.prepare('UPDATE state SET focus = 0 WHERE id = 1').run();
  return { focus: 0 };
});

app.get('/state', async () => {
  const row = db.prepare('SELECT focus FROM state WHERE id = 1').get();
  return { focus: row.focus };
});

app.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
