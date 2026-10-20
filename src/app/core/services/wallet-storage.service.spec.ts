import { TestBed } from '@angular/core/testing';
import { WalletStorageService } from './wallet-storage.service';
import { TransactionKind } from '../models/wallet.models';

describe('WalletStorageService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recarrega quando outra aba salva dados', () => {
    const storage = TestBed.inject(WalletStorageService);
    expect(storage.entries()).toEqual([]);

    // simula a outra aba: grava direto no localStorage e o navegador dispara "storage"
    localStorage.setItem(
      'sattva-wallet-entries-v1',
      JSON.stringify([
        { id: 'a1', kind: 'income', description: 'Salário', value: 2500, month: '2026-10' },
      ]),
    );
    window.dispatchEvent(new StorageEvent('storage', { key: 'sattva-wallet-entries-v1' }));

    expect(storage.entries()).toHaveLength(1);
  });

  it('avisa quando o navegador não deixa salvar', () => {
    const storage = TestBed.inject(WalletStorageService);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cheio', 'QuotaExceededError');
    });

    storage.add({
      kind: TransactionKind.Income,
      description: 'Pix',
      value: 10,
      month: '2026-10',
    });

    expect(storage.entries()).toHaveLength(1); // continua na memória
    expect(storage.saveFailed()).toBe(true);
  });
});
