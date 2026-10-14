import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  model,
  viewChild,
} from '@angular/core';

let nextId = 0;

@Component({
  selector: 'app-modal',
  templateUrl: './modal.html',
  styleUrl: './modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Modal {
  readonly heading = input.required<string>();
  readonly wide = input(false);
  readonly open = model(false);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  //id unico apra ligar o titulo ao dialog
  protected readonly titleId = `modal-title-${nextId++}`;

  //signal -> DOM: Mantém o dialog nativo sincronizado com o signal
  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;

      if (this.open() && !dialog.open) {
        dialog.showModal();
      } else if (!this.open() && dialog.open) {
        dialog.close();
      }
    });
  }

  close(): void {
    this.open.set(false);
  }

  protected closeOnBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.close();
    }
  }
}
