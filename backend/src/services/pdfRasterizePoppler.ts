import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const execFileAsync = promisify(execFile);

/**
 * Rasterize each PDF page to PNG via poppler `pdftoppm` (install: poppler-utils).
 */
export async function pdfBufferToPngBuffers(pdfBuffer: Buffer): Promise<Buffer[]> {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'pdf-ocr-'));
  const inPath = path.join(dir, 'input.pdf');
  const outPrefix = path.join(dir, 'page');
  try {
    await fs.writeFile(inPath, pdfBuffer);
    await execFileAsync('pdftoppm', ['-png', '-r', '200', inPath, outPrefix]);
    const names = (await fs.readdir(dir)).filter((n) => n.endsWith('.png') && n.startsWith('page'));
    names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const buffers: Buffer[] = [];
    for (const n of names) {
      buffers.push(await fs.readFile(path.join(dir, n)));
    }
    return buffers;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
