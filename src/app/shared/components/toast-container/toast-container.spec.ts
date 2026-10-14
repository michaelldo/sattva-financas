import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastContainer } from './toast-container';
import { ToastService } from '../../../core/services/toast.service';

describe('ToastContainer', () => {
  let fixture: ComponentFixture<ToastContainer>;
  let element: HTMLElement;
  let toasts: ToastService;

  beforeEach(async () => {
    fixture = TestBed.createComponent(ToastContainer);
    toasts = TestBed.inject(ToastService);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('mostra as mensagens do service', async () => {
    toasts.success('Backup importado com sucesso!');
    await fixture.whenStable();

    expect(element.querySelector('[role="status"]')?.textContent).toContain('Backup importado');
  });

  it('erros usam role="alert", lido imediatamente pelo leitor de tela', async () => {
    toasts.error('Arquivo inválido');
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Arquivo inválido');
  });

  it('o botão de ação executa a ação e fecha a mensagem', async () => {
    let undone = false;
    toasts.show('Lançamento excluído', {
      action: { label: 'Desfazer', run: () => (undone = true) },
    });
    await fixture.whenStable();

    element.querySelector<HTMLButtonElement>('.toast-action')!.click();
    await fixture.whenStable();

    expect(undone).toBe(true);
    expect(toasts.toasts()).toEqual([]);
  });
});
