import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EntryCard } from './entry-card';
import { WalletEntry } from '../../core/models/wallet.models';

const internet: WalletEntry = {
  id: 'abc',
  kind: 'fixed-expense',
  description: 'Internet',
  value: 120,
  month: '2026-10',
  createdAt: '2026-10-01T00:00:00.000Z',
  paidMonths: { '2026-10': true },
};

describe('EntryCard', () => {
  let fixture: ComponentFixture<EntryCard>;
  let element: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(EntryCard);
    fixture.componentRef.setInput('heading', 'Gastos Fixos');
    fixture.componentRef.setInput('itemLabel', 'gasto fixo');
    fixture.componentRef.setInput('month', '2026-10');
    fixture.componentRef.setInput('entries', [internet]);
    fixture.componentRef.setInput('showPaidStatus', true);
    await fixture.whenStable();
    element = fixture.nativeElement;
  });

  async function openList(): Promise<void> {
    element.querySelector<HTMLButtonElement>('.list-toggle')!.click();
    await fixture.whenStable();
  }

  it('mostra o título e a quantidade de lançamentos', () => {
    expect(element.querySelector('h2')?.textContent).toContain('Gastos Fixos');
    expect(element.querySelector('.list-toggle')?.textContent).toContain('1 Lançamento');
  });

  it('só mostra a lista depois de clicar no botão', async () => {
    expect(element.querySelector('.entry-list')).toBeNull();

    await openList();

    expect(element.querySelector('.entry-list')?.textContent).toContain('Internet');
  });

  it('mostra o status de pago do mês selecionado', async () => {
    await openList();
    expect(element.querySelector('.status-badge')?.textContent).toContain('Pago');

    fixture.componentRef.setInput('month', '2026-11');
    await fixture.whenStable();

    expect(element.querySelector('.status-badge')?.textContent).toContain('Não pago');
  });

  it('avisa o pai quando o usuário clica em remover', async () => {
    const removedIds: string[] = [];
    fixture.componentInstance.remove.subscribe((id) => removedIds.push(id));

    await openList();
    element.querySelector<HTMLButtonElement>('.remove-button')!.click();

    expect(removedIds).toEqual(['abc']);
  });
});
