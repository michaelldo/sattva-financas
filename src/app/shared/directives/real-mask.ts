import { Directive, ElementRef, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const realFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatReal(value: number | null): string {
  return value === null ? '' : realFormatter.format(value);
}

export function parseReal(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) / 100 : null;
}

@Directive({
  selector: 'input[appRealMask]',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RealMask),
      multi: true,
    },
  ],
  host: {
    inputmode: 'numeric',
    '(input)': 'handleInput()',
    '(blur)': 'onTouched()',
  },
})
export class RealMask implements ControlValueAccessor {
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;

  private onChange: (value: number | null) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: number | null): void {
    this.input.value = formatReal(value);
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.input.disabled = isDisabled;
  }

  protected handleInput(): void {
    const value = parseReal(this.input.value);
    this.input.value = formatReal(value);
    this.onChange(value);
  }
}
