import { addMonths, formatMonthLabel, MonthKey, monthRange } from '../utils/month.utils';
import { savedUntil } from '../utils/saving.utils';
import { SavingEntry, TransactionKind, WalletEntry, WalletSummary } from '../models/wallet.models';
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

      const summary = summarize(groups, month);
      summaries.push(summary);

      return {
        label: formatMonthLabel(month),
        spaceChildren: true,
        children: [
          this.kindNode('Entradas', groups[TransactionKind.Income]),
          this.kindNode('Gasto fixo', groups[TransactionKind.FixedExpense]),
          this.kindNode('Gasto variável', groups[TransactionKind.VariableExpense]),
          { label: this.balanceLabel(summary.balance, summary.savings) },
        ],
      };
    });

    const isSingleMonth = months.length === 1;
    const title = isSingleMonth
      ? `Relatório - ${formatMonthLabel(from)}`
      : `Relatório - ${formatMonthLabel(from)} a ${formatMonthLabel(to)}`;

    // O cofrinho não é mensal: aparece uma vez só, no fim, com o total guardado.
    const savingsNode = this.savingsNode(entries, from, to);
    const nodes = isSingleMonth
      ? [...monthNodes, savingsNode]
      : [...monthNodes, this.totalNode(summaries), savingsNode];

    return [title, ...renderTree(nodes, '', true)].join('\n');
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
    const sum = (field: keyof WalletSummary) =>
      summaries.reduce((total, summary) => total + summary[field], 0);

    return {
      label: 'Total do período',
      children: [
        { label: `Entradas: ${this.formatCurrency(sum('income'))}` },
        { label: `Gasto fixo: ${this.formatCurrency(sum('fixedExpenses'))}` },
        { label: `Gasto variável: ${this.formatCurrency(sum('variableExpenses'))}` },
        { label: this.balanceLabel(sum('balance'), sum('savings')) },
      ],
    };
  }

  /** O saldo já desconta o que foi guardado; quando houver, a linha explica a diferença. */
  private balanceLabel(balance: number, saved: number): string {
    const label = `Saldo: ${this.formatCurrency(balance)}`;
    return saved > 0
      ? `${label} (já descontados ${this.formatCurrency(saved)} do cofrinho)`
      : label;
  }

  /**
   * Seção única do cofrinho: cada cofrinho que existiu no período, com o total guardado
   * até o fim do período (ou até o mês anterior à retirada).
   */
  private savingsNode(entries: readonly WalletEntry[], from: MonthKey, to: MonthKey): TreeNode {
    const savings = entries.filter(
      (entry): entry is SavingEntry =>
        entry.kind === TransactionKind.Saving &&
        entry.month <= to &&
        (!entry.deletedFromMonth || entry.deletedFromMonth > from),
    );

    let activeTotal = 0;
    const children = savings.map((saving): TreeNode => {
      const withdrawn = saving.deletedFromMonth !== undefined && saving.deletedFromMonth <= to;
      const lastMonth = withdrawn ? addMonths(saving.deletedFromMonth!, -1) : to;
      const total = savedUntil(saving, lastMonth);

      if (!withdrawn) {
        activeTotal += total;
        return { label: `${saving.description}: ${this.formatCurrency(total)}` };
      }
      return {
        label: `${saving.description}: ${this.formatCurrency(total)} (retirado em ${formatMonthLabel(saving.deletedFromMonth!)})`,
      };
    });

    return { label: `Cofrinho (guardado): ${this.formatCurrency(activeTotal)}`, children };
  }

  private formatCurrency(value: number): string {
    return currencyFormatter.format(value);
  }
}
