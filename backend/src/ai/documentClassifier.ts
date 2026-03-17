import path from 'path';

export type DocumentKind = 'excel' | 'csv' | 'pdf' | 'word' | 'image' | 'unknown';

export interface ClassifiedDocument {
  kind: DocumentKind;
  ext: string;
}

export function classifyDocument(filename: string, mimeType: string): ClassifiedDocument {
  const ext = (path.extname(filename) || '').toLowerCase().replace('.', '');
  const mt = mimeType.toLowerCase();

  if (
    mt.includes('spreadsheet') ||
    mt.includes('excel') ||
    ext === 'xls' ||
    ext === 'xlsx'
  ) {
    return { kind: 'excel', ext };
  }
  if (mt.includes('csv') || ext === 'csv') {
    return { kind: 'csv', ext };
  }
  if (mt.includes('pdf') || ext === 'pdf') {
    return { kind: 'pdf', ext };
  }
  if (
    mt.includes('word') ||
    mt.includes('officedocument.wordprocessingml') ||
    ext === 'doc' ||
    ext === 'docx'
  ) {
    return { kind: 'word', ext };
  }
  if (
    mt.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(ext)
  ) {
    return { kind: 'image', ext };
  }
  return { kind: 'unknown', ext };
}

