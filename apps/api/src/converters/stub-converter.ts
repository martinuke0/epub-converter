import type { Converter, ConvertRequest, ConvertResult, ConverterHealth } from './types.js';

/**
 * Development fallback when Calibre sidecar is offline.
 * Returns a clearly-labeled stub file — never fake binary ebook bytes.
 */
export class StubConverter implements Converter {
  readonly name = 'stub';

  async health(): Promise<ConverterHealth> {
    return {
      ok: false,
      engine: 'stub',
      mode: 'stub',
      detail:
        'Calibre converter unavailable. Start with: docker compose up -d',
    };
  }

  async convert(req: ConvertRequest): Promise<ConvertResult> {
    const stem = req.filename.replace(/\.[^.]+$/, '');
    const text = [
      'Epub converter — STUB OUTPUT',
      '============================',
      '',
      'The Calibre conversion sidecar is not reachable.',
      'This is not a real ebook conversion.',
      '',
      `Input:  ${req.filename} (${req.from})`,
      `Output: ${req.to}`,
      '',
      'To enable real conversions:',
      '  docker compose up -d',
      '  # then retry',
      '',
    ].join('\n');

    // Always emit .txt so the user sees it's a stub, even if they asked for pdf/epub
    return {
      buffer: Buffer.from(text, 'utf8'),
      filename: `${stem}.STUB.txt`,
      mimeType: 'text/plain',
      jobId: 'stub',
    };
  }
}
