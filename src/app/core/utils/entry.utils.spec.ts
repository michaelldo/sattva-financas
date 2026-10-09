import { createEntry, isEntryPaidInMonth } from './entry.utils';

describe('entry.utils', () => {
  it('cria gasto variável como não pago', () => {
    const entry = createEntry({
      kind: 'variable-expense',
      description: 'Mercado',
      value: 200,
      month: '2026-10',
    });

    expect(entry).toMatchObject({ kind: 'variable-expense', paid: false });
    expect(isEntryPaidInMonth(entry, '2026-10')).toBe(false);
  });

  it('cria gasto fixo com paidMonths vazio', () => {
    const entry = createEntry({
      kind: 'fixed-expense',
      description: 'Internet',
      value: 120,
      month: '2026-10',
    });

    expect(entry).toMatchObject({ kind: 'fixed-expense', paidMonths: {} });
  });

  it('renda nunca está "paga"', () => {
    const entry = createEntry({ kind: 'income', description: 'Pix', value: 50, month: '2026-10' });

    expect(isEntryPaidInMonth(entry, '2026-10')).toBe(false);
  });
});
