import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { convertRoutes } from './routes/convert.js';
import { ensureTemp, startCleanupLoop } from './storage/temp.js';

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => origin || '*',
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    exposeHeaders: ['Content-Disposition', 'X-Job-Id', 'X-Stubbed', 'X-Filename'],
  })
);

app.get('/', (c) =>
  c.json({
    name: 'Epub',
    tagline: 'Convert ebooks without the clutter.',
    docs: '/api/health',
  })
);

app.route('/api', convertRoutes);

const port = Number(process.env.PORT || 8787);

await ensureTemp();
startCleanupLoop();

console.log(`Epub API listening on http://localhost:${port}`);
console.log(`CONVERTER_URL=${process.env.CONVERTER_URL || 'http://localhost:8090'}`);

serve({ fetch: app.fetch, port });
