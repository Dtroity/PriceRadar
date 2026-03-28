/** Единообразный вывод названия товара (убирает артефакты из Excel в уже сохранённых данных). */
export function displayProductName(name: string | null | undefined): string {
  if (name == null || name === '') return '';
  return name.replace(/^[\s/\\]+/u, '').trim();
}
