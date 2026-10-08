import { parseWalletEntry } from './entry-parser';

describe('parserWalletEntry', () => {

  it('converte o formato antigo de gasto fixo pago para paidMonths ', () => {
    const entry = parseWalletEntry({
      kind: 'fixed-expense',
      description: 'Aluguel',
      value: 1000,
      month: '2026-06',
      paid: true
    });

    expect(entry).toMatchObject({ kind: 'fixed-expense', paidMonths: {'2026-06' : true }});
    expect('paid' in entry).toBe(false);
  });

  it('Não deixa campos de outros tipos vazarem para renda', () => {
    const entry = parseWalletEntry({
      kind: 'income',
      description: 'Salário',
      value: 2500,
      paid: true,
      paidMonths: {},
    });

    expect(Object.keys(entry).sort()).toEqual(
      ['createdAt', 'description', 'id', 'kind', 'month', 'value'].sort(),
    );
  });

  it('rejeita valor inválido', () => {
    expect(() => parseWalletEntry({ kind: 'income', value: 'abc' })).toThrow(/valor inválido/i);
  });

  it('rejeita valor zero', () => {
    expect(() => parseWalletEntry({ kind: 'income', value: 0 })).toThrow(/valor inválido/i);
  });

});
