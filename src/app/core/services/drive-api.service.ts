import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
export const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
export const BACKUP_FILE_NAME = 'sattva-backup.json';

export interface DriveFile {
  id: string;
  modifiedTime: string;
}

@Injectable({ providedIn: 'root' })
export class DriveApiService {
  private readonly http = inject(HttpClient);

  async findBackup(): Promise<DriveFile | null> {
    const response = await firstValueFrom(
      this.http.get<{ files: DriveFile[] }>(DRIVE_FILES_URL, {
        params: {
          spaces: 'appDataFolder',
          q: `name = '${BACKUP_FILE_NAME}'`,
          fields: 'files(id, modifiedTime)',
        },
      }),
    );

    return response.files[0] ?? null;
  }

  download(fileId: string): Promise<string> {
    return firstValueFrom(
      this.http.get(`${DRIVE_FILES_URL}/${fileId}`, {
        params: { alt: 'media' },
        responseType: 'text',
      }),
    );
  }

  //Cria o arquivo de backup e devolve o id
  async create(content: string): Promise<string> {
    const metadata = {
      name: BACKUP_FILE_NAME,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    };

    //upload 'multipart' metadados nome, pasta e conteúdo em uma requisição só
    const body = new FormData();
    body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    body.append('file', new Blob([content], { type: 'application/json' }));

    const response = await firstValueFrom(
      this.http.post<{ id: string }>(DRIVE_UPLOAD_URL, body, {
        params: { uploadType: 'multipart', fields: 'id' },
      }),
    );
    return response.id;
  }

  async update(fieldsId: string, content: string): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${DRIVE_UPLOAD_URL}/${fieldsId}`, content, {
        params: { uploadType: 'media' },
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }
}
