import {
  buildInstallments,
  remainingAfterInstallment,
  splitIntoInstallments,
} from './installments';
import { createEntry } from './entry.utils';

describe('aplitIntoInstallments', () => {
  it('não perde centavos', () => {
    const parts = splitIntoInstallments(100, 3);
    expect(parts).toEqual([33.34, 33.33, 33.33]);
    expect(Math.round(parts.reduce((a, b) => a + b, 0) * 100)).toBe(10000);
  });

  it('divide valores exatos igualmente', () => {
    expect(splitIntoInstallments(3000, 3)).toEqual([1000, 1000, 1000]);
  });

  it('retorna o valor interiro quando é 1 parcela', () => {
    expect(splitIntoInstallments(59.9, 1)).toEqual([59.9]);
  });
});

describe('remainingAfterInstallment', () => {
  it('mostra quanto falta depois de cada parcela', () => {
    const entries = buildInstallments({
      description: 'Tênis',
      total: 150,
      count: 3,
      startMonth: '2026-10',
      groupId: 'g1',
    }).map((data) => createEntry(data));

    const remaining = remainingAfterInstallment(entries);

    expect(entries.map((entry) => remaining.get(entry.id))).toEqual([100, 50, 0]);
  });

  it('ignora lançamentos que não são parcelados', () => {
    const single = createEntry({
      kind: 'variable-expense',
      description: 'Lanche',
      value: 25,
      month: '2026-10',
    });

    expect(remainingAfterInstallment([single]).has(single.id)).toBe(false);
  });
});
