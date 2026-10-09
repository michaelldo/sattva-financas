import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { formatReal, parseReal, RealMask } from './real-mask';

describe('formatReal / parseReal', () => {
  it('formata no padrão brasileiro', () => {
    expect(formatReal(1234.5)).toBe('1.234,50');
    expect(formatReal(null)).toBe('');
  });

  it('trata os dígitos digitados como centavos', () => {
    expect(parseReal('12345')).toBe(123.45);
    expect(parseReal('1.234,50')).toBe(1234.5);
    expect(parseReal('abc')).toBeNull();
  });
});

@Component({
  imports: [ReactiveFormsModule, RealMask],
  template: `<input appRealMask [formControl]="control" />`,
})
class HostComponent {
  readonly control = new FormControl<number | null>(null);
}

describe('RealMask (no formulário)', () => {
  let host: HostComponent;
  let input: HTMLInputElement;

  beforeEach(async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    host = fixture.componentInstance;
    input = fixture.nativeElement.querySelector('input');
  });

  function type(text: string): void {
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }

  it('digitar atualiza o FormControl com número e formata o campo', () => {
    type('12345');

    expect(host.control.value).toBe(123.45);
    expect(input.value).toBe('123,45');
  });

  it('setValue no código aparece formatado no campo', () => {
    host.control.setValue(1500);

    expect(input.value).toBe('1.500,00');
  });

  it('reset limpa o campo', () => {
    type('999');
    host.control.reset();

    expect(input.value).toBe('');
    expect(host.control.value).toBeNull();
  });

  it('só marca como "tocado" quando o usuário sai do campo', () => {
    type('100');
    expect(host.control.touched).toBe(false);

    input.dispatchEvent(new Event('blur'));
    expect(host.control.touched).toBe(true);
  });

  it('desabilitar o FormControl desabilita o input', () => {
    host.control.disable();

    expect(input.disabled).toBe(true);
  });
});
