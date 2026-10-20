import { FixedExpenseEntry, VariableExpenseEntry, WalletEntry } from '../models/wallet.models';
import { editFixedFromMonth, editInstallmentGroup, restoreEntries } from './entry-edit';
import { buildInstallments } from './installments';
import { createEntry } from './entry.utils';

describe('editFixedFromMonth', () => {
  const rent: FixedExpenseEntry = {
    id: 'rent',
    kind: 'fixed-expense',
    description: 'Aluguel',
    value: 1000,
    month: '2026-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    paidMonths: { '2026-01': true, '2026-02': true, '2026-03': true },
  };

  it('preserva os meses anteriores e cria a continuação a partir do mês editado', () => {
    const result = editFixedFromMonth([rent], 'rent', '2026-03', {
      description: 'Aluguel',
      value: 1200,
    }) as FixedExpenseEntry[];

    expect(result).toHaveLength(2);

    const [old, current] = result;
    expect(old).toMatchObject({ id: 'rent', value: 1000, deletedFromMonth: '2026-03' });
    expect(old.paidMonths).toEqual({ '2026-01': true, '2026-02': true });

    expect(current.id).not.toBe('rent');
    expect(current).toMatchObject({ value: 1200, month: '2026-03' });
    expect(current.paidMonths).toEqual({ '2026-03': true });
  });

  it('no mês de criação, apenas altera o registro', () => {
    const result = editFixedFromMonth([rent], 'rent', '2026-01', {
      description: 'Aluguel',
      value: 1200,
    });

    expect(result).toEqual([{ ...rent, value: 1200 }]);
  });

  it('a continuação herda a data de encerramento do gasto original', () => {
    const ending = { ...rent, deletedFromMonth: '2026-06' };

    const [, current] = editFixedFromMonth([ending], 'rent', '2026-03', {
      description: 'Aluguel',
      value: 1200,
    }) as FixedExpenseEntry[];

    expect(current.deletedFromMonth).toBe('2026-06');
  });
});

describe('editInstallmentGroup', () => {
  function notebook(): WalletEntry[] {
    return buildInstallments({
      description: 'Notebook',
      total: 300,
      count: 3,
      startMonth: '2026-10',
      groupId: 'g1',
    }).map((data) => createEntry(data));
  }

  it('recalcula as parcelas a partir do novo total e da nova quantidade', () => {
    const result = editInstallmentGroup(notebook(), 'g1', {
      description: 'Notebook Dell',
      total: 1000,
      installments: 4,
    }) as VariableExpenseEntry[];

    expect(result.map((entry) => [entry.month, entry.value, entry.description])).toEqual([
      ['2026-10', 250, 'Notebook Dell Parc.:1/4'],
      ['2026-11', 250, 'Notebook Dell Parc.:2/4'],
      ['2026-12', 250, 'Notebook Dell Parc.:3/4'],
      ['2027-01', 250, 'Notebook Dell Parc.:4/4'],
    ]);
  });

  it('mantém id e status de pago das parcelas que continuam existindo', () => {
    const entries = notebook() as VariableExpenseEntry[];
    entries[0] = { ...entries[0], paid: true };

    const result = editInstallmentGroup(entries, 'g1', {
      description: 'Notebook',
      total: 300,
      installments: 2,
    }) as VariableExpenseEntry[];

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: entries[0].id, paid: true, value: 150 });
    expect(result[1]).toMatchObject({ id: entries[1].id, paid: false, value: 150 });
  });

  it('não mexe em outros lançamentos', () => {
    const other = createEntry({
      kind: 'income',
      description: 'Salário',
      value: 2500,
      month: '2026-10',
    });

    const result = editInstallmentGroup([other, ...notebook()], 'g1', {
      description: 'Notebook',
      total: 600,
      installments: 3,
    });

    expect(result).toContainEqual(other);
  });

  describe('restoreEntries', () => {
    const month = '2026-10';
    const market = createEntry({
      kind: 'variable-expense',
      description: 'Mercado',
      value: 300,
      month,
    });
    const rent = createEntry({ kind: 'fixed-expense', description: 'Aluguel', value: 1000, month });

    it('devolve um lançamento que foi removido', () => {
      expect(restoreEntries([rent], [market])).toEqual([rent, market]);
    });

    it('volta à versão original um lançamento que foi alterado', () => {
      const closed = { ...rent, deletedFromMonth: '2026-11' };

      expect(restoreEntries([closed, market], [rent])).toEqual([rent, market]);
    });
  });
});
