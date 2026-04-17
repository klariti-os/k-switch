require('dotenv').config();
const Fastify = require('fastify');
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.DB_URL,
  authToken: process.env.DB_TOKEN,
});

async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      focus INTEGER NOT NULL DEFAULT 0
    )
  `);
  await db.execute(`INSERT OR IGNORE INTO state (id, focus) VALUES (1, 0)`);
}

const app = Fastify();

app.register(require('@fastify/swagger'), {
  openapi: {
    info: { title: 'k-switch API', version: '1.0.0' },
  },
});

app.register(require('@fastify/swagger-ui'), {
  routePrefix: '/docs',
});

const focusResponse = {
  200: {
    type: 'object',
    properties: { focus: { type: 'integer', enum: [0, 1] } },
  },
};

app.post('/state/on', { schema: { response: focusResponse } }, async () => {
  await db.execute('UPDATE state SET focus = 1 WHERE id = 1');
  return { focus: 1 };
});

app.post('/state/off', { schema: { response: focusResponse } }, async () => {
  await db.execute('UPDATE state SET focus = 0 WHERE id = 1');
  return { focus: 0 };
});

app.get('/state', { schema: { response: focusResponse } }, async () => {
  const result = await db.execute('SELECT focus FROM state WHERE id = 1');
  return { focus: result.rows[0].focus };
});

initDb().then(() => {
  app.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Server listening at ${address}`);
  });
});
