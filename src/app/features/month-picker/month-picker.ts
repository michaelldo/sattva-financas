import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  linkedSignal,
  model,
  signal,
} from '@angular/core';
import {
  formatMonthLabel,
  MonthKey,
  monthKeyToDate,
  toMonthKey,
} from '../../core/utils/month.utils';

interface MonthOption {
  value: MonthKey;
  label: string;
}

const monthNameFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long' });

@Component({
  selector: 'app-month-picker',
  templateUrl: './month-picker.html',
  styleUrls: ['./month-picker.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'closeIfClickedOutside($event)',
    '(keydown.escape)': 'isOpen.set(false)',
  },
})
export class MonthPicker {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly month = model.required<MonthKey>();
  readonly isOpen = signal(false);
  readonly viewedYear = linkedSignal(() => monthKeyToDate(this.month()).getFullYear());
  readonly label = computed(() => formatMonthLabel(this.month()));
  readonly options = computed<MonthOption[]>(() =>
    Array.from({ length: 12 }, (_, index) => {
      const data = new Date(this.viewedYear(), index, 1);
      return { value: toMonthKey(data), label: monthNameFormatter.format(data) };
    }),
  );

  toggle(): void {
    this.isOpen.update((open) => !open);
  }

  changeYear(offset: number): void {
    this.viewedYear.update((year) => year + offset);
  }

  select(value: MonthKey): void {
    this.month.set(value);
    this.isOpen.set(false);
  }

  protected closeIfClickedOutside(event: MouseEvent): void {
    if (this.isOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }
}
