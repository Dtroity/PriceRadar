import { z } from 'zod';

/** POST /documents/:id/confirm — тело обычно пустое; лишние поля игнорируются */
export const ConfirmDocumentSchema = z.object({}).passthrough();
