import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  model,
} from '@angular/core';
import { WalletEntry } from '../../core/models/wallet.models';
import { ReportService } from '../../core/services/report.service';
import { ToastService } from '../../core/services/toast.service';
import { MonthKey, monthRange } from '../../core/utils/month.utils';
import { Modal } from '../../shared/components/modal/modal';
import { MonthPicker } from '../month-picker/month-picker';

/** Limite para o relatório não virar um texto gigante (ex.: ano digitado errado). */
export const MAX_REPORT_MONTHS = 36;

/**
 * Modal do relatório: escolhe o período, mostra, copia e imprime.
 * Todo o estado do relatório mora aqui; o App só diz se está aberto e quais são os dados.
 */
@Component({
  selector: 'app-report-dialog',
  imports: [Modal, MonthPicker],
  templateUrl: './report-dialog.html',
  styleUrl: './report-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportDialog {
  private readonly report = inject(ReportService);
  private readonly toast = inject(ToastService);

  readonly open = model(false);
  readonly entries = input.required<readonly WalletEntry[]>();
  /** Mês em que o relatório começa (o mês que está na tela). */
  readonly initialMonth = input.required<MonthKey>();

  // linkedSignal: começa com o valor do input, mas pode ser alterado pelos seletores.
  readonly from = linkedSignal(() => this.initialMonth());
  readonly to = linkedSignal(() => this.initialMonth());

  readonly rangeError = computed(() => {
    if (monthRange(this.from(), this.to()).length > MAX_REPORT_MONTHS) {
      return `Escolha um período de até ${MAX_REPORT_MONTHS} meses.`;
    }
    return null;
  });

  readonly text = computed(() =>
    this.rangeError()
      ? ''
      : this.report.build({ from: this.from(), to: this.to(), entries: this.entries() }),
  );

  /** Escolheu um início depois do fim? O fim acompanha (o período nunca fica invertido). */
  setFrom(month: MonthKey): void {
    this.from.set(month);
    if (month > this.to()) {
      this.to.set(month);
    }
  }

  /** Escolheu um fim antes do início? O início acompanha. */
  setTo(month: MonthKey): void {
    this.to.set(month);
    if (month < this.from()) {
      this.from.set(month);
    }
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.text());
      this.toast.success('Relatório copiado!');
    } catch {
      this.toast.error('Não foi possível copiar o relatório.');
    }
  }

  print(): void {
    window.print();
  }
}
