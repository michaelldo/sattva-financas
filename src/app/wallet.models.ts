export type TransactionKind = 'income' | 'fixed-expense' | 'variable-expense' | 'saving';

export interface WalletEntry {
  id: string;
  kind: TransactionKind;
  description: string;
  value: number;
  month: string;
  createdAt: string;
  paid?: boolean;
  paidMonths?: Record<string, boolean>;
  deletedFromMonth?: string;
  installment?: {
    groupId: string;
    current: number;
    total: number;
  };
}

export interface WalletSummary {
  income: number;
  fixedExpenses: number;
  variableExpenses: number;
  savings: number;
  balance: number;
}
