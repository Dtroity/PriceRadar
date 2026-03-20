/** OCR quality: auto-parse and normal status rules from parse confidence */
export const OCR_THRESHOLD_AUTO = 0.85;
/** Below this → ocr_failed, skip structured parse */
export const OCR_THRESHOLD_REVIEW = 0.6;

/** LLM parse confidence below this triggers rules fallback */
export const LLM_PARSE_CONFIDENCE_FALLBACK = 0.5;

/** Duplicate product name similarity (normalized) */
export const DUPLICATE_SIMILARITY_SUGGEST = 0.9;
export const DUPLICATE_SIMILARITY_AUTO = 0.95;

/** Price anomaly thresholds as fraction (compare against |change_pct|/100) */
export const ANOMALY_THRESHOLD_LOW = 0.08;
export const ANOMALY_THRESHOLD_MEDIUM = 0.15;
export const ANOMALY_THRESHOLD_HIGH = 0.3;
