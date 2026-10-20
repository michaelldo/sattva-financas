import { parseWalletEntry, withUniqueIds } from './entry-parser';
import { getCurrentMonth } from './month.utils';

describe('parserWalletEntry', () => {
  it('converte o formato antigo de gasto fixo pago para paidMonths ', () => {
    const entry = parseWalletEntry({
      kind: 'fixed-expense',
      description: 'Aluguel',
      value: 1000,
      month: '2026-06',
      paid: true,
    });

    expect(entry).toMatchObject({ kind: 'fixed-expense', paidMonths: { '2026-06': true } });
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

  it('mês inválido não derruba o app: usa o mês atual', () => {
    const entry = parseWalletEntry({ kind: 'income', description: 'Pix', value: 10, month: 'abc' });

    expect(entry.month).toBe(getCurrentMonth());
  });

  it('limpa paidMonths: só meses válidos marcados como pagos', () => {
    const entry = parseWalletEntry({
      kind: 'fixed-expense',
      description: 'Internet',
      value: 100,
      month: '2026-01',
      paidMonths: { '2026-01': true, '2026-02': false, lixo: true, '2026-03': 'sim' },
    });

    expect(entry).toMatchObject({ paidMonths: { '2026-01': true } });
  });

  it('descrição sempre texto, sem espaços sobrando e com tamanho máximo', () => {
    expect(parseWalletEntry({ kind: 'income', value: 1, description: { a: 1 } }).description).toBe(
      '',
    );
    expect(parseWalletEntry({ kind: 'income', value: 1, description: '  Pix  ' }).description).toBe(
      'Pix',
    );
    expect(
      parseWalletEntry({ kind: 'income', value: 1, description: 'x'.repeat(500) }).description,
    ).toHaveLength(120);
  });

  it('ids repetidos ganham um id novo', () => {
    const a = parseWalletEntry({ id: 'igual', kind: 'income', description: 'A', value: 1 });
    const b = parseWalletEntry({ id: 'igual', kind: 'income', description: 'B', value: 2 });

    const [first, second] = withUniqueIds([a, b]);

    expect(first.id).toBe('igual');
    expect(second.id).not.toBe('igual');
  });
});
