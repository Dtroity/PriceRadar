import { parseInvoiceRules } from '../../src/services/invoiceRulesParser.js';

describe('invoiceRulesParser', () => {
  it('пустой текст → пустые items', () => {
    const r = parseInvoiceRules('');
    expect(r.items).toHaveLength(0);
    expect(r.source).toBe('rules');
  });

  it('дата в формате DD.MM.YYYY (нормализуется в ISO)', () => {
    const r = parseInvoiceRules('Накладная от 15.03.2025 №123');
    expect(r.date).toBe('2025-03-15');
  });

  it('дата в формате DD-MM-YYYY', () => {
    const r = parseInvoiceRules('Дата: 01-06-2024');
    expect(r.date).toBe('2024-06-01');
  });

  it('кириллический номер документа после №', () => {
    const r = parseInvoiceRules('Накладная №УТ-00123 от 01.01.2025');
    expect(r.documentNumber).toBe('УТ-00123');
  });

  it('номер НФ-2025/01', () => {
    const r = parseInvoiceRules('УПД №НФ-2025/01 от 15.03.2025');
    expect(r.documentNumber).toBe('НФ-2025/01');
  });

  it('поставщик ООО в шапке', () => {
    const r = parseInvoiceRules('ООО Молочный Двор\nСтрока 2');
    expect(r.supplier).toContain('Молочный Двор');
  });

  it('поставщик из подписи «Поставщик:»', () => {
    const r = parseInvoiceRules('Поставщик: ООО Ромашка');
    expect(r.supplier).toContain('Ромашка');
  });

  it('название товара кириллицей (строка: наименование кол-во ед. цена)', () => {
    const r = parseInvoiceRules('Молоко  10  шт  89.50');
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items[0]!.name).toContain('Молоко');
  });
});
