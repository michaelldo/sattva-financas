import { Directive, HostListener, Self } from '@angular/core';
import { NgControl } from '@angular/forms';

@Directive({
  selector: '[appRealMask]',
  standalone: true
})
export class RealMask {
    // Injeta o controle do formulário associado ao input (formControlName)
  constructor(@Self() private ngControl: NgControl) {}

  @HostListener('input', ['$event'])
  onInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input) return;

    let value = input.value;

    value = value.replace(/\D/g, "");

    if (!value) {
      this.ngControl.control?.setValue(null, { emitEvent: false});
      input.value = '';
      return;
    }

    const numberValue = Number(value) / 100;

    this.ngControl.control?.setValue(numberValue, {emitEvent: false});
    this.ngControl.control?.markAsDirty();
    this.ngControl.control?.markAsTouched();

    const fomatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numberValue);

    setTimeout(() => {
      input.value = fomatted;
    })
  }
}
