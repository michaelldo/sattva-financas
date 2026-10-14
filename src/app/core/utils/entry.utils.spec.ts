import { createEntry, groupByKind, isEntryPaidInMonth, sumValues } from './entry.utils';

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

  it('agrupa por tipo e soma os valores', () => {
    const month = '2026-10';
    const groups = groupByKind([
      createEntry({ kind: 'income', description: 'Salário', value: 2500, month }),
      createEntry({ kind: 'fixed-expense', description: 'Aluguel', value: 1000, month }),
      createEntry({ kind: 'income', description: 'Pix', value: 50, month }),
    ]);

    expect(groups.income).toHaveLength(2);
    expect(groups['fixed-expense']).toHaveLength(1);
    expect(groups.saving).toEqual([]);
    expect(sumValues(groups.income)).toBe(2550);

    // Tipagem: sem nenhum `if`, o TypeScript já sabe que é FixedExpenseEntry
    expect(groups['fixed-expense'][0].paidMonths).toEqual({});
  });
});
