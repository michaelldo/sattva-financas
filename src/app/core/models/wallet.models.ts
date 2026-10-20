/** Tipo lançamento: funciona como enum */
export const TransactionKind = {
  Income: 'income',
  Saving: 'saving',
  FixedExpense: 'fixed-expense',
  VariableExpense: 'variable-expense',
} as const;

export type TransactionKind = (typeof TransactionKind)[keyof typeof TransactionKind];

interface BaseEntry {
  id: string;
  description: string;
  value: number;
  month: string;
  createdAt: string;
}

export interface IncomeEntry extends BaseEntry {
  kind: typeof TransactionKind.Income;
}

export interface SavingEntry extends BaseEntry {
  kind: typeof TransactionKind.Saving;
}

export interface FixedExpenseEntry extends BaseEntry {
  kind: typeof TransactionKind.FixedExpense;
  paidMonths: Record<string, boolean>;
  deletedFromMonth?: string;
}

export interface InstallmentInfo {
  groupId: string;
  current: number;
  total: number;
}

export interface VariableExpenseEntry extends BaseEntry {
  kind: typeof TransactionKind.VariableExpense;
  paid: boolean;
  installment?: InstallmentInfo;
}

export type WalletEntry = IncomeEntry | SavingEntry | FixedExpenseEntry | VariableExpenseEntry;

export interface WalletSummary {
  income: number;
  fixedExpenses: number;
  variableExpenses: number;
  savings: number;
  balance: number;
}

export type EntryOfKind<K extends TransactionKind> = Extract<WalletEntry, { kind: K }>;

export type EntriesByKind = { [K in TransactionKind]: EntryOfKind<K>[] };

/** Cofrinho: um valor guardado, continua existindo até ser retirado */
export interface SavingEntry extends BaseEntry {
  kind: typeof TransactionKind.Saving;
  deposits: Record<string, number>;
  deletedFromMonth?: string;
}
