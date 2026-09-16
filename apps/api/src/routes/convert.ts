import { Hono } from 'hono';
import {
  DEFAULT_OPTIONS,
  FORMATS,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  detectFormat,
  getCapabilities,
  isConversionSupported,
  type ConversionOptions,
  type FormatId,
} from '@epub/shared';
import {
  createConverter,
  createStub,
  type Converter,
} from '../converters/index.js';
import { deleteResult, getResult, storeResult } from '../storage/temp.js';

const allowStub = process.env.ALLOW_STUB === 'true';

async function resolveConverter(): Promise<{ converter: Converter; stubbed: boolean }> {
  const primary = createConverter();
  const health = await primary.health();
  if (health.ok) return { converter: primary, stubbed: false };
  if (allowStub) return { converter: createStub(), stubbed: true };
  throw new Error(
    health.detail ||
      'Calibre converter unavailable. Run: docker compose up -d'
  );
}

export const convertRoutes = new Hono();

convertRoutes.get('/health', async (c) => {
  const primary = createConverter();
  const health = await primary.health();
  return c.json({
    ok: true,
    api: 'epub-converter',
    converter: health,
    maxFileSizeMb: MAX_FILE_SIZE_MB,
    stubAllowed: allowStub,
  });
});

convertRoutes.get('/formats', (c) => {
  return c.json({
    formats: FORMATS,
    maxFileSizeMb: MAX_FILE_SIZE_MB,
  });
});

convertRoutes.get('/capabilities/:from', (c) => {
  const from = c.req.param('from') as FormatId;
  if (!FORMATS[from]) {
    return c.json({ error: 'Unknown format' }, 400);
  }
  return c.json({
    from,
    capabilities: getCapabilities(from),
  });
});

convertRoutes.post('/convert', async (c) => {
  let body: FormData;
  try {
    body = await c.req.formData();
  } catch {
    return c.json({ error: 'Expected multipart form data' }, 400);
  }

  const file = body.get('file');
  if (!(file instanceof File)) {
    return c.json({ error: 'Missing file field' }, 400);
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return c.json({ error: `File exceeds ${MAX_FILE_SIZE_MB}MB limit` }, 413);
  }
  if (file.size === 0) {
    return c.json({ error: 'Empty file' }, 400);
  }

  const toRaw = String(body.get('to') || '').toLowerCase() as FormatId;
  const fromRaw = String(body.get('from') || '').toLowerCase() as FormatId | '';
  const detected = detectFormat(file.name, file.type);
  const from = (fromRaw && FORMATS[fromRaw as FormatId] ? fromRaw : detected) as FormatId | null;

  if (!from) {
    return c.json({ error: 'Could not detect input format' }, 400);
  }
  if (!FORMATS[toRaw]) {
    return c.json({ error: `Unsupported output format: ${toRaw}` }, 400);
  }

  const support = isConversionSupported(from, toRaw);
  if (!support.ok) {
    return c.json({ error: support.reason || 'Unsupported conversion' }, 400);
  }

  let options: ConversionOptions = { ...DEFAULT_OPTIONS };
  const optsRaw = body.get('options');
  if (typeof optsRaw === 'string' && optsRaw.trim()) {
    try {
      options = { ...DEFAULT_OPTIONS, ...JSON.parse(optsRaw) };
    } catch {
      return c.json({ error: 'Invalid options JSON' }, 400);
    }
  }

  let converter: Converter;
  let stubbed = false;
  try {
    const resolved = await resolveConverter();
    converter = resolved.converter;
    stubbed = resolved.stubbed;
  } catch (e) {
    return c.json(
      {
        error: e instanceof Error ? e.message : 'Converter unavailable',
        hint: 'docker compose up -d',
      },
      503
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await converter.convert({
      buffer,
      filename: file.name,
      from,
      to: toRaw,
      options,
    });

    // Store for optional delayed download, also return immediately
    const stored = await storeResult(result.buffer, result.filename, result.mimeType);

    // If client wants JSON+download URL (batch UI), honor ?mode=json
    if (c.req.query('mode') === 'json') {
      return c.json({
        jobId: stored.id,
        filename: result.filename,
        mimeType: result.mimeType,
        size: result.buffer.length,
        stubbed,
        downloadUrl: `/api/download/${stored.id}`,
      });
    }

    return new Response(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'X-Job-Id': stored.id,
        'X-Stubbed': stubbed ? '1' : '0',
        'X-Filename': result.filename,
      },
    });
  } catch (e) {
    return c.json(
      {
        error: e instanceof Error ? e.message : 'Conversion failed',
      },
      500
    );
  }
});

convertRoutes.get('/download/:id', async (c) => {
  const id = c.req.param('id');
  const result = await getResult(id);
  if (!result) {
    return c.json({ error: 'File expired or not found' }, 404);
  }
  const { job, buffer } = result;
  // Delete after download (one-shot)
  const once = c.req.query('once') !== '0';
  if (once) {
    // Delay delete slightly so response can stream
    setTimeout(() => {
      void deleteResult(id);
    }, 1000);
  }
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': job.mimeType,
      'Content-Disposition': `attachment; filename="${job.filename}"`,
      'X-Job-Id': job.id,
    },
  });
});

convertRoutes.delete('/download/:id', async (c) => {
  await deleteResult(c.req.param('id'));
  return c.json({ ok: true });
});
