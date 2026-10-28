import { TestBed } from '@angular/core/testing';
import { BeforeInstallPromptEvent, detectGuide, InstallService } from './install.service';

/** Cria um `beforeinstallprompt` falso, com a resposta que a pessoa "deu". */
function fakeInstallPrompt(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
  const prompt = vi.fn(() => Promise.resolve());
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
  return { event, prompt };
}

describe('InstallService', () => {
  let service: InstallService;

  beforeEach(() => {
    service = TestBed.inject(InstallService);
    service.start();
  });

  it('só abre a janela direto quando o navegador avisa que dá para instalar', () => {
    expect(service.canPrompt()).toBe(false);

    const { event } = fakeInstallPrompt('accepted');
    window.dispatchEvent(event);

    expect(service.canPrompt()).toBe(true);
    expect(event.defaultPrevented).toBe(true); // a barrinha automática não aparece
  });

  it('abre a janela de instalação e informa se a pessoa aceitou', async () => {
    const { event, prompt } = fakeInstallPrompt('accepted');
    window.dispatchEvent(event);

    await expect(service.prompt()).resolves.toBe(true);
    expect(prompt).toHaveBeenCalledOnce();
    expect(service.canPrompt()).toBe(false); // o evento só vale uma vez
  });

  it('se a pessoa recusar, retorna false', async () => {
    window.dispatchEvent(fakeInstallPrompt('dismissed').event);

    await expect(service.prompt()).resolves.toBe(false);
  });

  it('sem o aviso do navegador, não faz nada', async () => {
    await expect(service.prompt()).resolves.toBe(false);
  });

  it('depois de instalado, marca como instalado', () => {
    window.dispatchEvent(fakeInstallPrompt('accepted').event);
    window.dispatchEvent(new Event('appinstalled'));

    expect(service.canPrompt()).toBe(false);
    expect(service.installed()).toBe(true);
  });
});

describe('detectGuide', () => {
  const cases: [string, string, string, number][] = [
    [
      'ios',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Safari/604.1',
      '',
      5,
    ],
    [
      'ios',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/141.0 Safari/604.1',
      '',
      5,
    ],
    [
      'ios',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15',
      'MacIntel',
      5,
    ],
    ['android', 'Mozilla/5.0 (Linux; Android 14) Chrome/141.0 Mobile Safari/537.36', '', 5],
    [
      'android',
      'Mozilla/5.0 (Linux; Android 14) Chrome/141.0 Mobile Safari/537.36 EdgA/141.0',
      '',
      5,
    ],
    [
      'android-firefox',
      'Mozilla/5.0 (Android 14; Mobile; rv:144.0) Gecko/144.0 Firefox/144.0',
      '',
      5,
    ],
    [
      'mac-safari',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15',
      'MacIntel',
      0,
    ],
    [
      'firefox-windows',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0',
      'Win32',
      0,
    ],
    [
      'firefox-desktop',
      'Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0',
      'Linux x86_64',
      0,
    ],
    ['desktop', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0 Safari/537.36', 'Win32', 0],
    [
      'desktop',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0 Safari/537.36 Edg/141.0',
      'Win32',
      0,
    ],
    [
      'desktop',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/141.0 Safari/537.36',
      'MacIntel',
      0,
    ],
  ];

  it.each(cases)('%s ← %s', (expected, userAgent, platform, maxTouchPoints) => {
    expect(detectGuide({ userAgent, platform, maxTouchPoints })).toBe(expected);
  });
});
