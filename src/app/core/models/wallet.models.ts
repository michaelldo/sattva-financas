interface BaseEntry {
  id: string;
  description: string;
  value: number;
  month: string;
  createdAt: string;
}

export interface IncomeEntry extends BaseEntry {
  kind: 'income';
}

export interface SavingEntry extends BaseEntry {
  kind: 'saving';
}

export interface FixedExpenseentry extends BaseEntry {
  kind: 'fixed-expense';
  paidMonths: Record<string, boolean>;
  deletedFromMonth?: string;
}

export interface InstallmentInfo {
  groupId: string;
  current: number;
  total: number;
}

export interface VariableExpenseEntry extends BaseEntry {
  kind: 'variable-expense';
  paid: boolean;
  installment?: InstallmentInfo;
}

export type WalletEntry = IncomeEntry | SavingEntry | FixedExpenseentry | VariableExpenseEntry;

export type TransactionKind = WalletEntry['kind'];

export interface WalletSummary {
  income: number;
  fixedExpenses: number;
  variableExpenses: number;
  savings: number;
  balance: number;
}
