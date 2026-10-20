import { addDeposit, editSavingMonth, mergeSavingGoals, savedUntil } from './saving.utils';
import { createEntry } from './entry.utils';
import { SavingEntry, TransactionKind, WalletEntry } from '../models/wallet.models';

function saving(entries: readonly WalletEntry[]): SavingEntry {
  return entries.find((entry): entry is SavingEntry => entry.kind === TransactionKind.Saving)!;
}

describe('saving.utils', () => {
  it('mesmo nome soma no mesmo cofrinho, guardando o valor de cada mês', () => {
    let entries = addDeposit([], { description: 'Viagem', value: 100, month: '2026-10' });
    entries = addDeposit(entries, { description: ' viagem ', value: 1000, month: '2026-11' });

    expect(entries).toHaveLength(1);
    expect(saving(entries)).toMatchObject({
      month: '2026-10',
      value: 1100,
      deposits: { '2026-10': 100, '2026-11': 1000 },
    });
  });

  it('total guardado até cada mês', () => {
    let entries = addDeposit([], { description: 'Viagem', value: 100, month: '2026-10' });
    entries = addDeposit(entries, { description: 'Viagem', value: 1000, month: '2026-11' });

    expect(savedUntil(saving(entries), '2026-10')).toBe(100);
    expect(savedUntil(saving(entries), '2026-12')).toBe(1100);
  });

  it('cofrinho retirado não recebe novos valores: vira um cofrinho novo', () => {
    const old = {
      ...saving(addDeposit([], { description: 'Viagem', value: 100, month: '2026-10' })),
      deletedFromMonth: '2026-12',
    };

    const entries = addDeposit([old], { description: 'Viagem', value: 50, month: '2027-01' });

    expect(entries).toHaveLength(2);
  });

  it('editar troca só o valor do mês; zerar todos os meses remove o cofrinho', () => {
    let entries = addDeposit([], { description: 'Viagem', value: 100, month: '2026-10' });
    entries = addDeposit(entries, { description: 'Viagem', value: 1000, month: '2026-11' });
    const id = saving(entries).id;

    entries = editSavingMonth(entries, id, '2026-11', { description: 'Viagem 2027', value: 500 });
    expect(saving(entries)).toMatchObject({
      description: 'Viagem 2027',
      value: 600,
      deposits: { '2026-10': 100, '2026-11': 500 },
    });

    entries = editSavingMonth(entries, id, '2026-10', { description: 'Viagem 2027', value: 0 });
    entries = editSavingMonth(entries, id, '2026-11', { description: 'Viagem 2027', value: 0 });
    expect(entries).toEqual([]);
  });

  it('migração: junta cofrinhos de mesmo nome que eram um por mês', () => {
    const october = createEntry({
      kind: TransactionKind.Saving,
      description: 'Viagem',
      value: 100,
      month: '2026-10',
    });
    const november = createEntry({
      kind: TransactionKind.Saving,
      description: 'viagem',
      value: 1000,
      month: '2026-11',
    });

    const merged = mergeSavingGoals([october, november]);

    expect(merged).toHaveLength(1);
    expect(saving(merged)).toMatchObject({
      id: october.id,
      value: 1100,
      deposits: { '2026-10': 100, '2026-11': 1000 },
    });
  });
});
