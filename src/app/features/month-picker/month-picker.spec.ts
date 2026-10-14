import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MonthPicker } from './month-picker';

@Component({
  imports: [MonthPicker],
  template: `<app-month-picker [(month)]="month" />
    <p class="outside">fora</p>`,
})
class HostComponent {
  readonly month = signal('2026-10');
}

describe('MonthPicker', () => {
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    element = fixture.nativeElement;
  });

  async function click(selector: string): Promise<void> {
    element.querySelector<HTMLElement>(selector)!.click();
    await fixture.whenStable();
  }

  function monthButtons(): HTMLButtonElement[] {
    return Array.from(element.querySelectorAll<HTMLButtonElement>('.month-grid button'));
  }

  it('mostra o mês selecionado no botão', () => {
    expect(element.querySelector('.month-trigger')?.textContent).toContain('outubro de 2026');
  });

  it('abre o painel com o mês atual destacado', async () => {
    await click('.month-trigger');

    expect(monthButtons()).toHaveLength(12);
    expect(element.querySelector('.is-selected')?.textContent).toContain('outubro');
  });

  it('escolher um mês atualiza o pai (two-way binding) e fecha o painel', async () => {
    await click('.month-trigger');
    monthButtons()[2].click(); // março
    await fixture.whenStable();

    expect(fixture.componentInstance.month()).toBe('2026-03');
    expect(element.querySelector('.month-panel')).toBeNull();
  });

  it('navega entre anos sem mudar o mês selecionado', async () => {
    await click('.month-trigger');
    await click('[aria-label="Próximo ano"]');

    expect(element.querySelector('.month-panel__header strong')?.textContent?.trim()).toBe('2027');
    expect(fixture.componentInstance.month()).toBe('2026-10');
  });

  it('volta para o ano do mês selecionado quando o pai muda o mês', async () => {
    await click('.month-trigger');
    await click('[aria-label="Próximo ano"]');

    fixture.componentInstance.month.set('2025-05');
    await fixture.whenStable();

    expect(element.querySelector('.month-panel__header strong')?.textContent?.trim()).toBe('2025');
  });

  it('fecha ao clicar fora', async () => {
    await click('.month-trigger');
    await click('.outside');

    expect(element.querySelector('.month-panel')).toBeNull();
  });
});
