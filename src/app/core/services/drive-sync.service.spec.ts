import { TestBed } from '@angular/core/testing';
import { BackupService } from './backup.service';
import { DriveApiService } from './drive-api.service';
import { DriveSyncService } from './drive-sync.service';
import { GoogleAuthService } from './google-auth.service';
import { WalletStorageService } from './wallet-storage.service';
import { createEntry } from '../utils/entry.utils';
import { TransactionKind } from '../models/wallet.models';

/** Um "Drive" de mentira que guarda o arquivo na memória. */
class FakeDriveApi {
  file: { id: string; content: string; modifiedTime: string } | null = null;
  created = 0;
  updated = 0;

  findBackup = async () =>
    this.file ? { id: this.file.id, modifiedTime: this.file.modifiedTime } : null;
  download = async () => this.file!.content;
  create = async (content: string) => {
    this.created++;
    this.file = { id: 'f1', content, modifiedTime: new Date().toISOString() };
    return 'f1';
  };
  update = async (_id: string, content: string) => {
    this.updated++;
    this.file = { ...this.file!, content };
  };
}

describe('DriveSyncService', () => {
  let drive: FakeDriveApi;
  let storage: WalletStorageService;
  let sync: DriveSyncService;
  let backup: BackupService;

  const salary = createEntry({
    kind: TransactionKind.Income,
    description: 'Salário',
    value: 2500,
    month: '2026-10',
  });

  beforeEach(() => {
    localStorage.clear();
    drive = new FakeDriveApi();

    TestBed.configureTestingModule({
      providers: [
        { provide: DriveApiService, useValue: drive },
        {
          provide: GoogleAuthService,
          useValue: { isConnected: () => false, hasValidToken: () => true },
        },
      ],
    });

    storage = TestBed.inject(WalletStorageService);
    sync = TestBed.inject(DriveSyncService);
    backup = TestBed.inject(BackupService);
  });

  it('primeira vez, sem backup no Drive: envia os dados locais', async () => {
    storage.add({
      kind: TransactionKind.Income,
      description: 'Salário',
      value: 2500,
      month: '2026-10',
    });

    expect(await sync.syncNow()).toBe('upload');
    expect(drive.created).toBe(1);
    expect(backup.parse(drive.file!.content)).toHaveLength(1);
    expect(sync.status()).toBe('synced');
  });

  it('aparelho novo: baixa os dados que estão no Drive', async () => {
    drive.file = {
      id: 'f1',
      content: backup.serialize([salary], new Date('2026-10-10T10:00:00.000Z')),
      modifiedTime: '2026-10-10T10:00:00.000Z',
    };

    expect(await sync.syncNow()).toBe('download');
    expect(storage.entries()).toEqual([salary]);
    expect(storage.lastModified()).toBe('2026-10-10T10:00:00.000Z');
  });

  it('dados locais mais novos: atualiza o arquivo do Drive', async () => {
    drive.file = {
      id: 'f1',
      content: backup.serialize([], new Date('2026-01-01T00:00:00.000Z')),
      modifiedTime: '2026-01-01T00:00:00.000Z',
    };
    storage.add({
      kind: TransactionKind.Income,
      description: 'Salário',
      value: 2500,
      month: '2026-10',
    });

    expect(await sync.syncNow()).toBe('upload');
    expect(drive.updated).toBe(1);
    expect(drive.created).toBe(0);
  });

  it('se o Drive falhar, o status vira erro', async () => {
    drive.findBackup = async () => {
      throw new Error('offline');
    };

    await expect(sync.syncNow()).rejects.toThrow('offline');
    expect(sync.status()).toBe('error');
  });
});
