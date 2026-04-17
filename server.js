require('dotenv').config();
const Fastify = require('fastify');
const { createClient } = require('@libsql/client');
const Ably = require('ably');

const db = createClient({
  url: process.env.DB_URL,
  authToken: process.env.DB_TOKEN,
});

const ably = new Ably.Rest(process.env.ABLY_API_KEY);
const channel = ably.channels.get('k-switch');

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

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>k-switch</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f0f0f;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
    }
    .label {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #555;
      transition: color 0.3s;
    }
    .label.on { color: #4ade80; }
    .switch {
      position: relative;
      width: 80px;
      height: 44px;
      cursor: pointer;
    }
    .switch input { display: none; }
    .track {
      position: absolute;
      inset: 0;
      background: #1e1e1e;
      border: 2px solid #2a2a2a;
      border-radius: 22px;
      transition: background 0.3s, border-color 0.3s;
    }
    .switch input:checked + .track {
      background: #166534;
      border-color: #4ade80;
    }
    .knob {
      position: absolute;
      top: 4px;
      left: 4px;
      width: 32px;
      height: 32px;
      background: #444;
      border-radius: 50%;
      transition: transform 0.3s, background 0.3s;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    }
    .switch input:checked ~ .knob {
      transform: translateX(36px);
      background: #4ade80;
    }
  </style>
</head>
<body>
  <div class="card">
    <span class="label" id="label">OFF</span>
    <label class="switch">
      <input type="checkbox" id="toggle">
      <div class="track"></div>
      <div class="knob"></div>
    </label>
  </div>
  <script src="https://cdn.ably.com/lib/ably.min-2.js"></script>
  <script>
    const toggle = document.getElementById('toggle');
    const label = document.getElementById('label');
    let current = null;

    function apply(focus) {
      if (focus === current) return;
      current = focus;
      toggle.checked = focus === 1;
      label.textContent = focus === 1 ? 'ON' : 'OFF';
      label.className = 'label' + (focus === 1 ? ' on' : '');
    }

    toggle.addEventListener('change', async () => {
      const url = toggle.checked ? '/state/on' : '/state/off';
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      apply(data.focus);
    });

    async function init() {
      const res = await fetch('/state');
      const data = await res.json();
      apply(data.focus);

      const tokenRes = await fetch('/state/token');
      const tokenRequest = await tokenRes.json();

      const realtime = new Ably.Realtime({ authCallback: (_params, callback) => callback(null, tokenRequest) });
      realtime.channels.get('k-switch').subscribe('state', (msg) => apply(msg.data.focus));
    }

    init();
  </script>
</body>
</html>`;

app.register(async function routes(fastify) {
  const focusResponse = {
    200: {
      type: 'object',
      properties: { focus: { type: 'integer', enum: [0, 1] } },
    },
  };

  fastify.get('/', { schema: { hide: true } }, async (_req, reply) => {
    reply.header('content-type', 'text/html; charset=utf-8').send(html);
  });

  fastify.get('/state/token', { schema: { hide: true } }, async () => {
    return ably.auth.createTokenRequest({ capability: { 'k-switch': ['subscribe'] } });
  });

  fastify.post('/state/on', { schema: { response: focusResponse } }, async () => {
    await db.execute('UPDATE state SET focus = 1 WHERE id = 1');
    await channel.publish('state', { focus: 1 });
    return { focus: 1 };
  });

  fastify.post('/state/off', { schema: { response: focusResponse } }, async () => {
    await db.execute('UPDATE state SET focus = 0 WHERE id = 1');
    await channel.publish('state', { focus: 0 });
    return { focus: 0 };
  });

  fastify.post('/state/toggle', { schema: { response: focusResponse } }, async () => {
    await db.execute('UPDATE state SET focus = 1 - focus WHERE id = 1');
    const result = await db.execute('SELECT focus FROM state WHERE id = 1');
    const focus = result.rows[0].focus;
    await channel.publish('state', { focus });
    return { focus };
  });

  fastify.get('/state', { schema: { response: focusResponse } }, async () => {
    const result = await db.execute('SELECT focus FROM state WHERE id = 1');
    return { focus: result.rows[0].focus };
  });
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
