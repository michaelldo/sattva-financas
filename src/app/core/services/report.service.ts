import { formatMonthLabel, MonthKey, monthRange } from '../utils/month.utils';
import { TransactionKind, WalletEntry, WalletSummary } from '../models/wallet.models';
import { Injectable } from '@angular/core';
import { groupByKind, isEntryVisibleInMonth, summarize, sumValues } from '../utils/entry.utils';
import { renderTree, TreeNode } from '../utils/tree.utils';

export interface ReportInput {
  from: MonthKey;
  to: MonthKey;
  entries: readonly WalletEntry[];
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

@Injectable({ providedIn: 'root' })
export class ReportService {
  build({ from, to, entries }: ReportInput): string {
    const months = monthRange(from, to);
    const summaries: WalletSummary[] = [];

    const monthNodes = months.map((month): TreeNode => {
      const groups = groupByKind(
        entries
          .filter((entry) => isEntryVisibleInMonth(entry, month))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      );

      const summary = summarize(groups);
      summaries.push(summary);

      return {
        label: formatMonthLabel(month),
        children: [
          this.kindNode('Entradas', groups[TransactionKind.Income]),
          this.kindNode('Gasto fixo', groups[TransactionKind.FixedExpense]),
          this.kindNode('Gasto variável', groups[TransactionKind.VariableExpense]),
          this.kindNode('Cofrinho', groups[TransactionKind.Saving]),
          { label: `Saldo: ${this.formatCurrency(summary.balance)}` },
        ],
      };
    });

    const isSingleMonth = months.length === 1;
    const title = isSingleMonth
      ? `Relatório - ${formatMonthLabel(from)}`
      : `Relatório - ${formatMonthLabel(from)} a ${formatMonthLabel(to)}`;

    const nodes = isSingleMonth ? monthNodes : [...monthNodes, this.totalNode(summaries)];

    return [title, ...renderTree(nodes)].join('\n');
  }

  private kindNode(title: string, entries: readonly WalletEntry[]): TreeNode {
    return {
      label: `${title}: ${this.formatCurrency(sumValues(entries))}`,
      children: entries.map((entry) => ({
        label: `${entry.description}: ${this.formatCurrency(entry.value)}`,
      })),
    };
  }

  private totalNode(summaries: readonly WalletSummary[]): TreeNode {
    const total = (field: keyof WalletSummary) =>
      this.formatCurrency(summaries.reduce((sum, summary) => sum + summary[field], 0));

    return {
      label: 'Total do período',
      children: [
        { label: `Entradas: ${total('income')}` },
        { label: `Gasto fixo: ${total('fixedExpenses')}` },
        { label: `Gasto variável: ${total('variableExpenses')}` },
        { label: `Cofrinho: ${total('savings')}` },
        { label: `Saldo: ${total('balance')}` },
      ],
    };
  }

  private formatCurrency(value: number): string {
    return currencyFormatter.format(value);
  }
}
