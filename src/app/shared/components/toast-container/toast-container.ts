import { ChangeDetectionStrategy, Component, effect, ElementRef, inject } from '@angular/core';
import { Toast, ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  templateUrl: './toast-container.html',
  styleUrl: './toast-container.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    popover: 'manual',
  },
})
export class ToastContainer {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly toastService = inject(ToastService);

  constructor() {
    effect(() => {
      const hasToasts = this.toastService.toasts().length > 0;

      if (!('showPopover' in this.host)) {
        return;
      }

      if (hasToasts) {
        this.host.hidePopover();
        this.host.showPopover();
      } else {
        this.host.hidePopover();
      }
    });
  }

  protected runAction(toast: Toast): void {
    toast.action?.run();
    this.toastService.dismiss(toast.id);
  }
}
