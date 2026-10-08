import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { WalletEntry } from '../../core/models/wallet.models';
import { isEntryPaidInMonth } from '../../core/utils/entry.utils';
import { MonthKey } from '../../core/utils/month.utils';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-entry-card',
  imports: [CurrencyPipe],
  templateUrl: './entry-card.html',
  styleUrl: './entry-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.dark]': "variant() === 'dark'",
  },
})
export class EntryCard {
  //input
  readonly heading = input.required<string>();
  readonly itemLabel = input.required<string>();
  readonly entries = input.required<WalletEntry[]>();
  readonly month = input.required<MonthKey>();
  readonly showPaidStatus = input(false);
  readonly variant = input<'light' | 'dark'>('light');

  //output
  readonly remove = output<string>();
  readonly togglePaid = output<WalletEntry>();

  readonly listOpen = signal(false);

  readonly countLabel = computed(() => {
    const count = this.entries().length;
    return `${count} ${count <= 1 ? 'Lançamento' : 'Lançamentos'}`;
  });

  readonly paidIds = computed(
    () =>
      new Set(
        this.entries()
          .filter((entry) => isEntryPaidInMonth(entry, this.month()))
          .map((entry) => entry.id),
      ),
  );

  toggleList(): void {
    this.listOpen.update((isOpen) => !isOpen);
  }
}
