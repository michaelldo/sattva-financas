import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DRIVE_FILES_URL, DRIVE_UPLOAD_URL, DriveApiService } from './drive-api.service';

describe('DriveApiService', () => {
  let api: DriveApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(DriveApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Garante que nenhuma requisição ficou sem resposta ou foi feita sem querer.
    http.verify();
  });

  it('procura o backup na pasta oculta do app', async () => {
    const result = api.findBackup();

    const request = http.expectOne((req) => req.url === DRIVE_FILES_URL);
    expect(request.request.params.get('spaces')).toBe('appDataFolder');
    expect(request.request.params.get('q')).toBe("name = 'sattva-backup.json'");
    request.flush({ files: [{ id: 'f1', modifiedTime: '2026-10-16T10:00:00.000Z' }] });

    expect(await result).toEqual({ id: 'f1', modifiedTime: '2026-10-16T10:00:00.000Z' });
  });

  it('devolve null quando ainda não existe backup', async () => {
    const result = api.findBackup();
    http.expectOne((req) => req.url === DRIVE_FILES_URL).flush({ files: [] });

    expect(await result).toBeNull();
  });

  it('baixa o conteúdo do arquivo como texto', async () => {
    const result = api.download('f1');

    const request = http.expectOne((req) => req.url === `${DRIVE_FILES_URL}/f1`);
    expect(request.request.params.get('alt')).toBe('media');
    request.flush('{"entries":[]}');

    expect(await result).toBe('{"entries":[]}');
  });

  it('cria o arquivo na pasta do app e devolve o id', async () => {
    const result = api.create('{"entries":[]}');

    const request = http.expectOne((req) => req.url === DRIVE_UPLOAD_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.params.get('uploadType')).toBe('multipart');
    request.flush({ id: 'novo' });

    expect(await result).toBe('novo');
  });

  it('atualiza o conteúdo de um arquivo existente', async () => {
    const result = api.update('f1', '{"entries":[]}');

    const request = http.expectOne((req) => req.url === `${DRIVE_UPLOAD_URL}/f1`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toBe('{"entries":[]}');
    request.flush({});

    await result;
  });
});
