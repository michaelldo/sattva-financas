import { Injectable, signal } from '@angular/core';

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Em qual navegador/sistema estamos, para saber que passo a passo mostrar quando o site
 * não consegue abrir a janela de instalação sozinho.
 */
export type InstallGuide =
  | 'ios'
  | 'android'
  | 'android-firefox'
  | 'mac-safari'
  | 'firefox-windows'
  | 'firefox-desktop'
  | 'desktop';

@Injectable({ providedIn: 'root' })
export class InstallService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  private readonly available = signal(false);
  private readonly installedState = signal(isStandalone());

  readonly canPrompt = this.available.asReadonly();
  readonly installed = this.installedState.asReadonly();
  readonly guide: InstallGuide = detectGuide(navigator);

  start(): void {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this.available.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.available.set(false);
      this.installedState.set(true);
    });
  }

  /** Abre a janela de instalação do navegador. Retorna `true` se a pessoa aceitou. */
  async prompt(): Promise<boolean> {
    const prompt = this.deferredPrompt;
    if (!prompt) {
      return false;
    }

    this.deferredPrompt = null;
    this.available.set(false);

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    return outcome === 'accepted';
  }
}

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

export function detectGuide(
  nav: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>,
): InstallGuide {
  const ua = nav.userAgent;
  const firefox = /firefox|fxios/i.test(ua);
  const iPadAsMac = nav.platform === 'MacIntel' && nav.maxTouchPoints > 1;

  if (/iphone|ipad|ipod/i.test(ua) || iPadAsMac) {
    return 'ios';
  }
  if (/android/i.test(ua)) {
    return firefox ? 'android-firefox' : 'android';
  }
  if (firefox) {
    return /windows/i.test(ua) ? 'firefox-windows' : 'firefox-desktop';
  }
  if (/macintosh/i.test(ua) && /safari/i.test(ua) && !/chrome|chromium|edg|opr/i.test(ua)) {
    return 'mac-safari';
  }
  return 'desktop';
}
