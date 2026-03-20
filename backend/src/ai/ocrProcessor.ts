import Tesseract from 'tesseract.js';
import sharp from 'sharp';

const OCR_LANG = process.env.OCR_LANG ?? 'rus+eng';

export async function preprocessImage(inputPath: string): Promise<Buffer> {
  const image = sharp(inputPath)
    .greyscale()
    .normalize()
    .sharpen()
    .resize({ width: 2000, withoutEnlargement: true });
  return image.toBuffer();
}

export async function runOcr(inputPath: string): Promise<string> {
  const buffer = await preprocessImage(inputPath);
  const { data } = await Tesseract.recognize(buffer, OCR_LANG);
  return data.text ?? '';
}

/** Tesseract on an in-memory image (fallback when Vision fails or is unavailable). */
export async function runOcrFromBuffer(imageBuffer: Buffer): Promise<{ text: string; confidence: number }> {
  const processed = await sharp(imageBuffer)
    .greyscale()
    .normalize()
    .sharpen()
    .resize({ width: 2000, withoutEnlargement: true })
    .toBuffer();
  const { data } = await Tesseract.recognize(processed, OCR_LANG);
  const raw = typeof data.confidence === 'number' ? data.confidence : 0;
  const confidence = Math.min(1, Math.max(0, raw / 100));
  return { text: data.text ?? '', confidence };
}

