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

