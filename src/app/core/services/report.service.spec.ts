import { TestBed } from '@angular/core/testing';
import { ReportService } from './report.service';
import { WalletEntry } from '../models/wallet.models';

function entry(partial: Partial<WalletEntry>): WalletEntry {
  return {
    id: crypto.randomUUID(),
    kind: 'variable-expense',
    description: 'Teste',
    value: 10,
    month: '2026-10',
    createdAt: '2026-10-01T00:00:00.000Z',
    ...partial,
  };
}

describe('ReportService', () => {
  let service: ReportService;

  beforeEach(() => {
    service = TestBed.inject(ReportService);
  });

  it('mostra o saldo e os gastos variáveis agrupados por mês', () => {
    const allEntries = [
      entry({ description: 'Mercado', value: 200, month: '2026-10' }),
      entry({ description: 'Farmácia', value: 100, month: '2026-11' }),
    ];

    const report = service.build({
      month: '2026-10',
      summary: {
        income: 1000,
        fixedExpenses: 0,
        variableExpenses: 200,
        savings: 0,
        balance: 800,
      },
      fixedEntries: [],
      allEntries,
    });

    expect(report).toContain('Resumo - outubro de 2026');
    expect(report).toContain('Mercado: R$');
    expect(report).toContain('novembro de 2026');
    expect(report).toContain('Nenhum Lançamento');
  });
});
