import { TestBed } from '@angular/core/testing';
import { ReportService } from './report.service';
import { TransactionKind } from '../models/wallet.models';
import { createEntry } from '../utils/entry.utils';

describe('ReportService', () => {
  let service: ReportService;

  const entries = [
    createEntry({
      kind: TransactionKind.Income,
      description: 'Salário',
      value: 3000,
      month: '2026-10',
    }),
    createEntry({
      kind: TransactionKind.FixedExpense,
      description: 'Aluguel',
      value: 1000,
      month: '2026-10',
    }),
    createEntry({
      kind: TransactionKind.VariableExpense,
      description: 'Mercado',
      value: 200,
      month: '2026-11',
    }),
    createEntry({
      kind: TransactionKind.VariableExpense,
      description: 'Farmácia',
      value: 50,
      month: '2027-01',
    }),
  ];

  beforeEach(() => {
    service = TestBed.inject(ReportService);
  });

  it('um mês só: sem bloco de total', () => {
    const report = service.build({ from: '2026-10', to: '2026-10', entries });

    expect(report).toContain('Relatório - outubro de 2026');
    expect(report).toContain('Salário: R$');
    expect(report).toContain('Saldo: R$');
    expect(report).not.toContain('Total do período');
  });

  it('só traz lançamentos dentro do período', () => {
    const report = service.build({ from: '2026-10', to: '2026-11', entries });

    expect(report).toContain('Mercado');
    expect(report).not.toContain('Farmácia');
  });

  it('gasto fixo se repete em cada mês e entra no total do período', () => {
    const report = service.build({ from: '2026-10', to: '2026-11', entries });

    expect(report.match(/Aluguel/g)).toHaveLength(2);
    expect(report).toContain('Total do período');
    // 3000 - 1000 (out) - 1000 - 200 (nov) = 800
    expect(report).toMatch(/└── Saldo: R\$\s800,00$/);
  });
});
