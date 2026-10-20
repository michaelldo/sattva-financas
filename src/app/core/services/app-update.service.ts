import { DestroyRef, inject, Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { ToastService } from './toast.service';

/** Até quantos ms depois de abrir/voltar ao app a atualização é aplicada sozinha. */
export const AUTO_UPDATE_WINDOW_MS = 10_000;
/** Enquanto o app fica aberto, procura versão nova a cada 30 minutos. */
export const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Mantém o app na versão mais recente publicada.
 *
 * O service worker sempre abre a versão que está no cache (é o que deixa o app rápido e
 * offline) e só depois descobre que existe uma nova. Por isso:
 * - logo depois de abrir (ou de voltar ao app), a versão nova é aplicada sozinha;
 * - depois disso, aparece o aviso "Nova versão disponível", para não recarregar no meio do uso.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  private activeSince = Date.now();

  start(): void {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    this.swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => this.onVersionReady());

    this.swUpdate.unrecoverable.subscribe(() => this.reload());

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        this.activeSince = Date.now();
        void this.check();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    const timer = setInterval(() => void this.check(), UPDATE_CHECK_INTERVAL_MS);

    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    });
  }

  reload(): void {
    document.location.reload();
  }

  private onVersionReady(): void {
    const justOpened = Date.now() - this.activeSince < AUTO_UPDATE_WINDOW_MS;

    if (justOpened && !isTyping()) {
      this.reload();
      return;
    }

    this.toast.show('Nova versão disponível.', {
      duration: null,
      action: { label: 'Atualizar', run: () => this.reload() },
    });
  }

  private async check(): Promise<void> {
    try {
      await this.swUpdate.checkForUpdate();
    } catch {
      // sem internet: tenta de novo na próxima vez
    }
  }
}

function isTyping(): boolean {
  const element = document.activeElement;
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}
