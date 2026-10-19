import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
  action?: ToastAction;
}

export interface ToastOptions {
  kind?: ToastKind;
  action?: ToastAction;
  duration?: number | null;
}

const DEFAULT_DURATION = 4000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastsSignal = signal<Toast[]>([]);
  private nextId = 0;

  readonly toasts = this.toastsSignal.asReadonly();

  show(message: string, options: ToastOptions = {}): number {
    const toast: Toast = {
      id: this.nextId++,
      message,
      kind: options.kind ?? 'info',
      action: options.action,
    };

    this.toastsSignal.update((toasts) => [...toasts, toast]);
    const duration = options.duration === undefined ? DEFAULT_DURATION : options.duration;
    if (duration !== null) {
      setTimeout(() => this.dismiss(toast.id), duration);
    }

    return toast.id;
  }

  success(message: string): number {
    return this.show(message, { kind: 'success' });
  }

  error(message: string): number {
    return this.show(message, { kind: 'error', duration: 6000 });
  }

  dismiss(id: number): void {
    this.toastsSignal.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }
}
