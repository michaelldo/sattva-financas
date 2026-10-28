import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { SideMenu } from './side-menu';
import { DriveSyncService } from '../../core/services/drive-sync.service';
import { ToastService } from '../../core/services/toast.service';
import { WalletStorageService } from '../../core/services/wallet-storage.service';
import { TransactionKind } from '../../core/models/wallet.models';
import { InstallService } from '../../core/services/install.service';

@Component({
  imports: [SideMenu],
  template: `<app-side-menu [(open)]="open" (openReport)="reportRequests = reportRequests + 1" />`,
})
class HostComponent {
  readonly open = signal(true);
  reportRequests = 0;
}

describe('SideMenu', () => {
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;
  let menu: SideMenu;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    element = fixture.nativeElement;
    menu = fixture.debugElement.children[0].componentInstance;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function button(text: string): HTMLButtonElement {
    return Array.from(element.querySelectorAll<HTMLButtonElement>('.menu-item')).find((item) =>
      item.textContent?.includes(text),
    )!;
  }

  it('"Relatório" fecha o menu e avisa o pai', async () => {
    button('Relatório').click();
    await fixture.whenStable();

    expect(fixture.componentInstance.open()).toBe(false);
    expect(fixture.componentInstance.reportRequests).toBe(1);
  });

  it('"Instalar app" abre a janela do navegador quando ele permite', async () => {
    TestBed.inject(InstallService).start();
    const prompt = vi.fn(() => Promise.resolve());
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
    window.dispatchEvent(event);

    button('Instalar app').click();
    await fixture.whenStable();

    expect(prompt).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(menu.installHelpOpen()).toBe(false);
    expect(TestBed.inject(ToastService).toasts()).toMatchObject([{ message: 'App instalado!' }]);
  });

  it('"Instalar app" mostra o passo a passo quando o navegador não abre a janela', async () => {
    button('Instalar app').click();
    await fixture.whenStable();

    expect(fixture.componentInstance.open()).toBe(false);
    expect(menu.installHelpOpen()).toBe(true);
  });

  it('"Instalar app" some depois de instalado', async () => {
    TestBed.inject(InstallService).start();
    window.dispatchEvent(new Event('appinstalled'));
    await fixture.whenStable();

    expect(button('Instalar app')).toBeUndefined();
  });

  it('"Como usar o backup" fecha o menu e abre a ajuda', async () => {
    button('Como usar o backup').click();
    await fixture.whenStable();

    expect(fixture.componentInstance.open()).toBe(false);
    expect(menu.helpOpen()).toBe(true);
  });

  it('importar backup pode ser desfeito pelo aviso', async () => {
    const storage = TestBed.inject(WalletStorageService);
    const toasts = TestBed.inject(ToastService);
    storage.add({
      kind: TransactionKind.Income,
      description: 'Salário',
      value: 2500,
      month: '2026-10',
    });

    const file = new File(
      [
        JSON.stringify({
          entries: [{ kind: 'income', description: 'Outro', value: 1, month: '2026-10' }],
        }),
      ],
      'backup.json',
    );
    await menu.importBackup({ target: { files: [file], value: '' } } as unknown as Event);
    expect(storage.entries().map((entry) => entry.description)).toEqual(['Outro']);

    toasts.toasts().at(-1)!.action!.run();
    expect(storage.entries().map((entry) => entry.description)).toEqual(['Salário']);
  });

  it('conecta o Google Drive e sincroniza', async () => {
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          revoke: vi.fn(),
          initTokenClient: (config: google.accounts.oauth2.TokenClientConfig) => ({
            requestAccessToken: () =>
              config.callback({
                access_token: 'token',
                expires_in: '3600',
              } as google.accounts.oauth2.TokenResponse),
          }),
        },
      },
    });
    // Sem HTTP de verdade: o DriveSyncService tem testes próprios.
    const syncNow = vi
      .spyOn(TestBed.inject(DriveSyncService), 'syncNow')
      .mockResolvedValue('upload');

    button('Conectar Google Drive').click();
    await fixture.whenStable();

    expect(element.querySelector('.drive-status')?.textContent).toContain('Conectado');
    expect(syncNow).toHaveBeenCalledOnce();
    expect(TestBed.inject(ToastService).toasts().at(-1)?.message).toBe('Backup salvo no Drive.');
  });
});
