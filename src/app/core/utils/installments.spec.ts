import { splitIntoInstallments } from './installments';

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
  })
})
