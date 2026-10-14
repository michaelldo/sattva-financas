import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra a mensagem e some sozinha depois do tempo definido', () => {
    service.success('Backup importado');
    expect(service.toasts()).toMatchObject([{ message: 'Backup importado', kind: 'success' }]);

    vi.advanceTimersByTime(3999);
    expect(service.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(service.toasts()).toEqual([]);
  });

  it('erros ficam mais tempo na tela', () => {
    service.error('Falhou');

    vi.advanceTimersByTime(4000);
    expect(service.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(2000);
    expect(service.toasts()).toEqual([]);
  });

  it('dismiss remove só a mensagem indicada', () => {
    const first = service.show('Primeira');
    service.show('Segunda');

    service.dismiss(first);

    expect(service.toasts().map((toast) => toast.message)).toEqual(['Segunda']);
  });
});
