import { decideSync } from './sync.utils';

const OLD = '2026-10-01T10:00:00.000Z';
const NEW = '2026-10-16T10:00:00.000Z';

describe('decideSync', () => {
  it('sem backup no Drive: envia os dados locais', () => {
    expect(decideSync({ modifiedAt: NEW, isEmpty: false }, null)).toBe('upload');
  });

  it('sem backup e sem dados locais: não faz nada', () => {
    expect(decideSync({ modifiedAt: OLD, isEmpty: true }, null)).toBe('none');
  });

  it('aparelho novo, sem dados: sempre baixa do Drive', () => {
    expect(decideSync({ modifiedAt: NEW, isEmpty: true }, OLD)).toBe('download');
  });

  it('a versão mais recente vence', () => {
    expect(decideSync({ modifiedAt: OLD, isEmpty: false }, NEW)).toBe('download');
    expect(decideSync({ modifiedAt: NEW, isEmpty: false }, OLD)).toBe('upload');
  });

  it('mesma data: já está sincronizado', () => {
    expect(decideSync({ modifiedAt: NEW, isEmpty: false }, NEW)).toBe('none');
  });
});
