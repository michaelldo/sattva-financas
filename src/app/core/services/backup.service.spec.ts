import { TestBed } from '@angular/core/testing';

import { BackupService } from './backup.service';
import { WalletEntry } from '../models/wallet.models';

describe('BackupService', () => {
  let service: BackupService;

  beforeEach(() => {
    service = TestBed.inject(BackupService);
  });

  it('exportar e importar os mesmos lançamentos (ida e volta) ', () => {
    const entries: WalletEntry[] = [
      {
        id: '1',
        kind: 'income',
        description: 'Salário',
        value: 2500,
        month: '2026-10',
        createdAt: '2026-10-01T10:00:00.000Z',
      },
    ];

    const json = service.serialize(entries);

    expect(service.parse(json)).toEqual([expect.objectContaining(entries[0])]);
  });

  it('aceita o formato antigo (array direto)', () => {
    const json = JSON.stringify([
      {
        kind: 'income',
        description: 'pix',
        value: 50,
        month: '2026-10',
      },
    ]);

    expect(service.parse(json)).toHaveLength(1);
  });

  it('rejeita arquivo sem lista de lançamentos', () => {
    expect(() => service.parse('{"foo": 1}')).toThrow('Arquivo de backup inválido');
  });

  it('rejeita lançamento com valor inválido', () => {
    const json = JSON.stringify({
      entries: [
        {
          kind: 'income',
          description: 'X',
          value: 'abc',
        },
      ],
    });
    expect(() => service.parse(json)).toThrow('valor inválido');
  });
});
