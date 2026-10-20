import { TestBed } from '@angular/core/testing';
import { GoogleAuthService } from './google-auth.service';

/**
 * A biblioteca real do Google abre um popup e fala com os servidores dele.
 * Nos testes o objeto global `google` foi trocado por um falso (mock),
 */
function mockGoogle(respond: (config: google.accounts.oauth2.TokenClientConfig) => void) {
  const revoke = vi.fn();
  const requestAccessToken = vi.fn();

  vi.stubGlobal('google', {
    accounts: {
      oauth2: {
        revoke,
        initTokenClient: (config: google.accounts.oauth2.TokenClientConfig) => ({
          requestAccessToken: (override?: { prompt?: string }) => {
            requestAccessToken(override);
            respond(config);
          },
        }),
      },
    },
  });

  return { revoke, requestAccessToken };
}

function grantToken(config: google.accounts.oauth2.TokenClientConfig): void {
  config.callback({
    access_token: 'token-123',
    expires_in: '3600',
  } as google.accounts.oauth2.TokenResponse);
}

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;

  beforeEach(() => {
    localStorage.clear();
    service = TestBed.inject(GoogleAuthService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('conecta, guarda o token e lembra a conexão para a próxima visita', async () => {
    const { requestAccessToken } = mockGoogle(grantToken);

    await service.connect();

    expect(service.status()).toBe('connected');
    expect(await service.getAccessToken()).toBe('token-123');
    expect(localStorage.getItem('sattva-drive-connected')).toBe('true');
    // primeira conexão: pede o consentimento explicitamente
    expect(requestAccessToken).toHaveBeenCalledWith({ prompt: 'consent' });
  });

  it('reaproveita o token enquanto ele é válido', async () => {
    const { requestAccessToken } = mockGoogle(grantToken);
    await service.connect();

    await service.getAccessToken();
    await service.getAccessToken();

    expect(requestAccessToken).toHaveBeenCalledTimes(1);
  });

  it('volta para desconectado se o usuário fechar o popup', async () => {
    mockGoogle((config) =>
      config.error_callback?.({
        type: 'popup_closed',
        message: 'closed',
        name: 'Error',
      } as google.accounts.oauth2.ClientConfigError),
    );

    await expect(service.connect()).rejects.toThrow('Conexão cancelada.');
    expect(service.status()).toBe('disconnected');
  });

  it('desconectar revoga o token e esquece a conexão', async () => {
    const { revoke } = mockGoogle(grantToken);
    await service.connect();

    service.disconnect();

    expect(revoke).toHaveBeenCalledWith('token-123', expect.any(Function));
    expect(service.status()).toBe('disconnected');
    expect(localStorage.getItem('sattva-drive-connected')).toBeNull();
  });
});
