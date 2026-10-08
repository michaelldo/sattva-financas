import { WalletEntry } from '../models/wallet.models';
import { MonthKey } from './month.utils';

export function isEntryPaidInMonth(entry: WalletEntry, month: MonthKey): boolean {
  if (entry.kind === 'fixed-expense') {
    return Boolean(entry.paidMonths?.[month]);
  }

  return Boolean(entry.paid);
}
