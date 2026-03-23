/** Короткая относительная дата для карточек списков */
export function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffM = Math.floor(diffMs / 60000);
  if (diffM < 1) return 'только что';
  if (diffM < 60) return `${diffM} мин`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH} ч`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} дн`;
  return d.toLocaleDateString();
}
