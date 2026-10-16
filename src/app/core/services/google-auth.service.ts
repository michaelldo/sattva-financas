import { computed, Injectable, signal } from '@angular/core';
import { DRIVE_SCOPE, GIS_SCRIPT_URL, GOOGLE_CLIENT_ID } from '../config/google.config';

export type DriveConnectionStatus = 'disconnected' | 'connecting' | 'connected';

/** lembra a pagina que o usuario já conectou */
const CONNECTED_FLAG_KEY = 'sattva-drive-connected';
/** margem para renovar o token (1 min) */
const EXPIRY_MARGIN_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private scriptLoading?: Promise<void>;
  private accessToken: string | null = null;
  private expiresAt = 0;

  private readonly statusSignal = signal<DriveConnectionStatus>('disconnected');
  private readonly wasConnectedSignal = signal(readConnectedFlag());

  readonly status = this.statusSignal.asReadonly();
  readonly isConnected = computed(() => this.statusSignal() === 'connected');
  /** verificar se o token da sessão atual existe */
  readonly needsReconnect = computed(
    () => this.wasConnectedSignal() && this.statusSignal() === 'disconnected',
  );

  /**
   * Abre o popup do google através do clique
   */
  async connect(): Promise<void> {
    this.statusSignal.set('connecting');

    try {
      await this.requestToken(this.wasConnectedSignal() ? '' : 'consent');
      this.statusSignal.set('connected');
      this.setConnectedFlag(true);
    } catch (error) {
      this.statusSignal.set('disconnected');
      throw error;
    }
  }

  /** Devolve um token valido */
  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt - EXPIRY_MARGIN_MS) {
      return this.accessToken;
    }

    return this.requestToken('');
  }

  disconnect(): void {
    if (this.accessToken && typeof google !== 'undefined') {
      google.accounts.oauth2.revoke(this.accessToken, () => {});
    }

    this.accessToken = null;
    this.expiresAt = 0;
    this.statusSignal.set('disconnected');
    this.setConnectedFlag(false);
  }

  private async requestToken(prompt: '' | 'consent'): Promise<string> {
    await this.loadScript();

    // Callback do google
    return new Promise<string>((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPE,
        callback: (response) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }

          this.accessToken = response.access_token;
          this.expiresAt = Date.now() + Number(response.expires_in) * 1000;
          resolve(response.access_token);
        },
        error_callback: (error) => {
          reject(new Error(error.type === 'popup_closed' ? 'Conexão cancelada.' : error.message));
        },
      });

      client.requestAccessToken({ prompt });
    });
  }

  private loadScript(): Promise<void> {
    if (typeof google !== 'undefined' && google.accounts?.oauth2) {
      return Promise.resolve();
    }

    this.scriptLoading ??= new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GIS_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        this.scriptLoading = undefined; //permite tentar novamente.
        reject(new Error('Não foi possível carregar o login do google'));
      };
      document.head.appendChild(script);
    });

    return this.scriptLoading;
  }

  private setConnectedFlag(connected: boolean): void {
    this.wasConnectedSignal.set(connected);

    try {
      if (connected) {
        localStorage.setItem(CONNECTED_FLAG_KEY, 'true');
      } else {
        localStorage.removeItem(CONNECTED_FLAG_KEY);
      }
    } catch {
      //LocalStorage indisponível ( ex: modo privado )
    }
  }
}

function readConnectedFlag(): boolean {
  try {
    return localStorage.getItem(CONNECTED_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}
