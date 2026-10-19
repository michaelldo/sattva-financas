import {
  createEntry,
  groupByKind,
  isEntryPaidInMonth,
  isEntryVisibleInMonth,
  summarize,
  sumUnpaid,
  sumValues,
} from './entry.utils';
import { TransactionKind } from '../models/wallet.models';

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

    expect(groups['fixed-expense'][0].paidMonths).toEqual({});
  });

  it('soma só os gastos não pagos do mês', () => {
    const month = '2026-10';
    const rent = {
      ...createEntry({ kind: 'fixed-expense', description: 'Aluguel', value: 1000, month }),
      paidMonths: { [month]: true },
    };
    const market = createEntry({
      kind: 'variable-expense',
      description: 'Mercado',
      value: 300,
      month,
    });
    const internet = createEntry({
      kind: 'fixed-expense',
      description: 'Internet',
      value: 120,
      month,
    });
    const salary = createEntry({ kind: 'income', description: 'Salário', value: 5000, month });

    expect(sumUnpaid([rent, market, internet, salary], month)).toBe(420);
  });
});

describe('isEntryVisibleInMonth', () => {
  it('gasto fixo aparece do mês de criação até o mês da exclusão', () => {
    const rent = {
      ...createEntry({
        kind: TransactionKind.FixedExpense,
        description: 'Aluguel',
        value: 1000,
        month: '2026-03',
      }),
      deletedFromMonth: '2026-06',
    };

    expect(isEntryVisibleInMonth(rent, '2026-02')).toBe(false);
    expect(isEntryVisibleInMonth(rent, '2026-03')).toBe(true);
    expect(isEntryVisibleInMonth(rent, '2026-05')).toBe(true);
    expect(isEntryVisibleInMonth(rent, '2026-06')).toBe(false);
  });

  it('os outros tipos aparecem só no próprio mês', () => {
    const salary = createEntry({
      kind: TransactionKind.Income,
      description: 'Salário',
      value: 2500,
      month: '2026-03',
    });

    expect(isEntryVisibleInMonth(salary, '2026-03')).toBe(true);
    expect(isEntryVisibleInMonth(salary, '2026-04')).toBe(false);
  });
});

describe('summarize', () => {
  it('soma cada tipo e calcula o saldo', () => {
    const month = '2026-10';
    const groups = groupByKind([
      createEntry({ kind: TransactionKind.Income, description: 'Salário', value: 3000, month }),
      createEntry({
        kind: TransactionKind.FixedExpense,
        description: 'Aluguel',
        value: 1000,
        month,
      }),
      createEntry({
        kind: TransactionKind.VariableExpense,
        description: 'Mercado',
        value: 500,
        month,
      }),
      createEntry({ kind: TransactionKind.Saving, description: 'Reserva', value: 300, month }),
    ]);

    expect(summarize(groups)).toEqual({
      income: 3000,
      fixedExpenses: 1000,
      variableExpenses: 500,
      savings: 300,
      balance: 1200,
    });
  });
});
