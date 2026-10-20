import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { googleAuthInterceptor } from './google-auth.interceptor';
import { GoogleAuthService } from './google-auth.service';

describe('googleAuthInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([googleAuthInterceptor])),
        provideHttpClientTesting(),
        // Um GoogleAuthService falso: só precisamos do token.
        { provide: GoogleAuthService, useValue: { getAccessToken: () => Promise.resolve('tok') } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  it('adiciona o token nas chamadas às APIs do Google', async () => {
    const response = firstValueFrom(http.get('https://www.googleapis.com/drive/v3/files'));

    // o interceptor espera o token (Promise) antes de enviar a requisição
    await Promise.resolve();
    const request = controller.expectOne('https://www.googleapis.com/drive/v3/files');
    expect(request.request.headers.get('Authorization')).toBe('Bearer tok');
    request.flush({});

    await response;
  });

  it('não envia o token para outros endereços', () => {
    http.get('/manifest.webmanifest').subscribe();

    const request = controller.expectOne('/manifest.webmanifest');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
});
