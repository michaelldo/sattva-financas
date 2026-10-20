import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Modal } from './modal';

@Component({
  imports: [Modal],
  template: `
    <app-modal heading="Ajuda" [(open)]="isOpen">
      <p class="content">Conteúdo projetado</p>
    </app-modal>
  `,
})
class HostComponent {
  readonly isOpen = signal(false);
}

describe('Modal', () => {
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;
  let dialog: HTMLDialogElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    element = fixture.nativeElement;
    dialog = element.querySelector('dialog')!;
  });

  async function setOpen(value: boolean): Promise<void> {
    fixture.componentInstance.isOpen.set(value);
    await fixture.whenStable();
  }

  it('começa fechado e abre quando o signal do pai muda', async () => {
    expect(dialog.open).toBe(false);

    await setOpen(true);

    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('Conteúdo projetado');
  });

  it('o botão × fecha e avisa o pai', async () => {
    await setOpen(true);

    element.querySelector<HTMLButtonElement>('[aria-label="Fechar"]')!.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.isOpen()).toBe(false);
    expect(dialog.open).toBe(false);
  });

  it('fechar pelo navegador (ESC) também avisa o pai', async () => {
    await setOpen(true);

    dialog.close(); // é o que o navegador faz ao apertar ESC
    await fixture.whenStable();

    expect(fixture.componentInstance.isOpen()).toBe(false);
  });

  it('clique no fundo fecha, clique no conteúdo não', async () => {
    await setOpen(true);

    element.querySelector<HTMLElement>('.content')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.isOpen()).toBe(true);

    dialog.click(); // o alvo é o próprio <dialog> = área do fundo
    await fixture.whenStable();
    expect(fixture.componentInstance.isOpen()).toBe(false);
  });

  it('liga o título ao dialog para leitores de tela', () => {
    const titleId = dialog.getAttribute('aria-labelledby');

    expect(element.querySelector(`#${titleId}`)?.textContent).toContain('Ajuda');
  });

  it('variant="drawer" aplica o visual de painel lateral', async () => {
    expect(dialog.classList.contains('drawer')).toBe(false);

    const drawerFixture = TestBed.createComponent(Modal);
    drawerFixture.componentRef.setInput('heading', 'Menu');
    drawerFixture.componentRef.setInput('variant', 'drawer');
    await drawerFixture.whenStable();

    const drawer = (drawerFixture.nativeElement as HTMLElement).querySelector('dialog')!;
    expect(drawer.classList.contains('drawer')).toBe(true);
  });
});
