/** Multer sometimes stores UTF-8 filenames as Latin-1 bytes → mojibake in logs and errors. */
export function decodeMultipartFilename(name: string): string {
  if (!name) return name;
  if (!/Ð|Ñ|Ã/.test(name)) return name;
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}
