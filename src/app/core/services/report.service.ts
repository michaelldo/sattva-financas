import { Injectable } from '@angular/core';
import { WalletEntry, WalletSummary } from '../models/wallet.models';
import { formatMonthLabel, MonthKey } from '../utils/month.utils';

export interface ReportInput {
  month: MonthKey;
  summary: WalletSummary;
  fixedEntries: WalletEntry[];
  allEntries: WalletEntry[];
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

@Injectable({ providedIn: 'root' })
export class ReportService {
  build({ month, summary, fixedEntries, allEntries }: ReportInput): string {
    const variableMonths = this.groupByMonth(this.sortedByKind(allEntries, 'variable-expense'));
    const savingMonths = this.groupByMonth(this.sortedByKind(allEntries, 'saving'));

    const lines = [
      `Resumo - ${formatMonthLabel(month)}`,
      '├── Saldo',
      `|   └── ${this.formatCurrency(summary.balance)}`,
      '|',
      '├── Entradas',
      `|   └── ${this.formatCurrency(summary.income)}`,
      '|',
      '├── Gasto Fixo',
      `|   ├── Total: ${this.formatCurrency(summary.fixedExpenses)}`,
      ...this.formatEntryLines(fixedEntries, '|   '),
      '|',
      '├── Gasto variavel',
      ...this.formatMonthGroups(variableMonths, '|   '),
      '|',
      '└── Cofrinho',
      ...this.formatMonthGroups(savingMonths, '    '),
    ];

    return lines.join('\n');
  }

  private sortedByKind(entries: WalletEntry[], kind: WalletEntry['kind']): WalletEntry[] {
    return entries
      .filter((entry) => entry.kind === kind)
      .sort((a, b) => a.month.localeCompare(b.month) || a.createdAt.localeCompare(b.createdAt));
  }

  private formatMonthGroups(groups: Map<string, WalletEntry[]>, prefix: string): string[] {
    if (groups.size === 0) {
      return [`${prefix}└── Nenhum Lançamento`];
    }

    return Array.from(groups.entries()).flatMap(([month, entries], monthIndex, allMonths) => {
      const isLastMonth = monthIndex === allMonths.length - 1;
      const monthBranch = isLastMonth ? '└──' : '├──';
      const childPrefix = `${prefix}${isLastMonth ? '    ' : '|   '}`;
      const total = entries.reduce((sum, entry) => sum + entry.value, 0);

      return [
        `${prefix}${monthBranch} ${formatMonthLabel(month)}`,
        `${childPrefix}├── Total: ${this.formatCurrency(total)}`,
        ...this.formatEntryLines(entries, childPrefix),
      ];
    });
  }

  private formatEntryLines(entries: WalletEntry[], prefix: string): string[] {
    if (entries.length === 0) {
      return [`${prefix}└── Nenhum Lançamento`];
    }

    return entries.map((entry, index) => {
      const branch = index === entries.length - 1 ? '└──' : '├──';
      return `${prefix}${branch} ${entry.description}: ${this.formatCurrency(entry.value)}`;
    });
  }

  private groupByMonth(entries: WalletEntry[]): Map<string, WalletEntry[]> {
    const groups = new Map<string, WalletEntry[]>();

    for (const entry of entries) {
      const list = groups.get(entry.month) ?? [];
      list.push(entry);
      groups.set(entry.month, list);
    }
    return groups;
  }

  private formatCurrency(value: number): string {
    return currencyFormatter.format(value);
  }
}
