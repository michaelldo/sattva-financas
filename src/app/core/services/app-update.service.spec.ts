import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AppUpdateService, AUTO_UPDATE_WINDOW_MS } from './app-update.service';
import { ToastService } from './toast.service';

/** Um SwUpdate de mentira: nós decidimos quando "chega" uma versão nova. */
class FakeSwUpdate {
  readonly isEnabled = true;
  readonly versionUpdates = new Subject<VersionEvent>();
  readonly unrecoverable = new Subject<unknown>();
  readonly checkForUpdate = vi.fn().mockResolvedValue(false);
}

const versionReady: VersionEvent = {
  type: 'VERSION_READY',
  currentVersion: { hash: 'antiga' },
  latestVersion: { hash: 'nova' },
};

describe('AppUpdateService', () => {
  let sw: FakeSwUpdate;
  let service: AppUpdateService;
  let reload: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    sw = new FakeSwUpdate();
    TestBed.configureTestingModule({ providers: [{ provide: SwUpdate, useValue: sw }] });
    service = TestBed.inject(AppUpdateService);
    reload = vi.spyOn(service, 'reload').mockImplementation(() => undefined);
    service.start();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('versão nova logo ao abrir: atualiza sozinho', () => {
    sw.versionUpdates.next(versionReady);

    expect(reload).toHaveBeenCalledOnce();
  });

  it('versão nova no meio do uso: só avisa', () => {
    vi.advanceTimersByTime(AUTO_UPDATE_WINDOW_MS + 1);
    sw.versionUpdates.next(versionReady);

    expect(reload).not.toHaveBeenCalled();
    const toast = TestBed.inject(ToastService).toasts()[0];
    expect(toast.message).toBe('Nova versão disponível.');

    toast.action!.run();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('ao voltar para o app, procura atualização e volta a atualizar sozinho', () => {
    vi.advanceTimersByTime(AUTO_UPDATE_WINDOW_MS + 1);

    document.dispatchEvent(new Event('visibilitychange'));
    expect(sw.checkForUpdate).toHaveBeenCalled();

    sw.versionUpdates.next(versionReady);
    expect(reload).toHaveBeenCalledOnce();
  });
});
