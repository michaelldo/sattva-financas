import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EntryForm, EntryFormValue } from './entry-form';

@Component({
  imports: [EntryForm],
  template: `<app-entry-form
    placeholder="Mercado"
    [allowInstallments]="allowInstallments"
    (submitted)="received.push($event)"
  />`,
})
class HostComponent {
  allowInstallments = true;
  readonly received: EntryFormValue[] = [];
}

describe('EntryForm', () => {
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    element = fixture.nativeElement;
  });

  function type(selector: string, text: string): void {
    const input = element.querySelector<HTMLInputElement>(selector)!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }

  async function submit(): Promise<void> {
    element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
  }

  it('entrega a descrição sem espaços sobrando e limpa o formulário', async () => {
    type('[formControlName="description"]', '  Mercado  ');
    type('[formControlName="value"]', '15050');
    await submit();

    expect(fixture.componentInstance.received).toEqual([
      { description: 'Mercado', value: 150.5, installments: 1 },
    ]);
    expect(element.querySelector<HTMLInputElement>('[formControlName="description"]')!.value).toBe(
      '',
    );
  });

  it('não envia descrição só com espaços', async () => {
    type('[formControlName="description"]', '   ');
    type('[formControlName="value"]', '100');
    await submit();

    expect(fixture.componentInstance.received).toEqual([]);
  });

  it('com "Parcelado?" marcado, envia a quantidade de parcelas', async () => {
    type('[formControlName="description"]', 'Notebook');
    type('[formControlName="value"]', '300000');
    element.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await fixture.whenStable();

    type('[formControlName="installments"]', '3');
    await submit();

    expect(fixture.componentInstance.received).toEqual([
      { description: 'Notebook', value: 3000, installments: 3 },
    ]);
  });

  it('sem parcelamento permitido, não mostra o "Parcelado?"', async () => {
    fixture.componentInstance.allowInstallments = false;
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();

    expect(element.querySelector('input[type="checkbox"]')).toBeNull();
  });
});
