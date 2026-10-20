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
    expect(report).toMatch(/└── Saldo: R\$\s800,00$/m);
  });

  it('cofrinho aparece uma vez só, no fim, com o total acumulado', () => {
    const viagem = {
      ...createEntry({
        kind: TransactionKind.Saving,
        description: 'Viagem',
        value: 1100,
        month: '2026-10',
      }),
      deposits: { '2026-10': 100, '2026-11': 1000 },
    };

    const report = service.build({ from: '2026-10', to: '2026-11', entries: [viagem] });

    expect(report.match(/Viagem/g)).toHaveLength(1);
    expect(report).toMatch(
      /└── Cofrinho \(guardado\): R\$\s1\.100,00\n\s+└── Viagem: R\$\s1\.100,00$/,
    );
    // o saldo de cada mês desconta só o que foi guardado nele
    expect(report).toContain('já descontados R$\u00a0100,00 do cofrinho');
    expect(report).toContain('já descontados R$\u00a01.000,00 do cofrinho');
  });

  it('cofrinho retirado aparece com o total até o mês anterior', () => {
    const viagem = {
      ...createEntry({
        kind: TransactionKind.Saving,
        description: 'Viagem',
        value: 1100,
        month: '2026-10',
      }),
      deposits: { '2026-10': 100, '2026-11': 1000 },
      deletedFromMonth: '2026-12',
    };

    const report = service.build({ from: '2026-10', to: '2026-12', entries: [viagem] });

    expect(report).toContain('Viagem: R$\u00a01.100,00 (retirado em dezembro de 2026)');
    expect(report).toContain('Cofrinho (guardado): R$\u00a00,00');
  });
});
