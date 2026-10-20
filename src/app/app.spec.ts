import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { appConfig } from './app.config';
import { ToastService } from './core/services/toast.service';
import { isEntryPaidInMonth } from './core/utils/entry.utils';
import { TransactionKind } from './core/models/wallet.models';

/** Atalho: simula o formulário de um card enviando um lançamento. */
function add(
  app: App,
  kind: TransactionKind,
  description: string,
  value: number,
  installments = 1,
) {
  app.addEntry(kind, { description, value, installments });
}

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [App],
      providers: appConfig.providers,
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the balance title', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Balanço');
  });

  it('should update the summary when income is added', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    add(app, TransactionKind.Income, 'Salario', 2500);

    expect(app.summary().income).toBe(2500);
    expect(app.summary().balance).toBe(2500);
  });

  it('should remove the selected installment and the following installments', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    add(app, TransactionKind.VariableExpense, 'Notebook', 3000, 3);

    const secondInstallment = app
      .entries()
      .find((entry) => entry.kind === 'variable-expense' && entry.installment?.current === 2);

    expect(secondInstallment).toBeTruthy();

    app.removeEntry(secondInstallment!.id);

    expect(
      app.entries().map((entry) => entry.kind === 'variable-expense' && entry.installment?.current),
    ).toEqual([1]);
  });

  it('should hide fixed expenses from the selected month forward when removed', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.currentMonth.set('2026-06');
    add(app, TransactionKind.FixedExpense, 'Aluguel', 1000);

    expect(app.entriesByKind()['fixed-expense'].length).toBe(1);

    app.currentMonth.set('2026-07');
    app.removeEntry(app.entriesByKind()['fixed-expense'][0].id);

    expect(app.entriesByKind()['fixed-expense'].length).toBe(0);

    app.currentMonth.set('2026-06');

    expect(app.entriesByKind()['fixed-expense'].length).toBe(1);

    app.currentMonth.set('2026-08');

    expect(app.entriesByKind()['fixed-expense'].length).toBe(0);
  });

  it('should show fixed expenses only from the month they were created', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.currentMonth.set('2026-07');
    add(app, TransactionKind.FixedExpense, 'Aluguel ajustado', 1100);

    expect(app.entriesByKind()['fixed-expense'].length).toBe(1);

    app.currentMonth.set('2026-06');

    expect(app.entriesByKind()['fixed-expense'].length).toBe(0);
  });

  it('should create expenses as unpaid and toggle paid status', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    add(app, TransactionKind.FixedExpense, 'Internet', 120);

    const expense = () => app.entriesByKind()['fixed-expense'][0];

    expect(isEntryPaidInMonth(expense(), app.currentMonth())).toBe(false);

    app.togglePaidStatus(expense());

    // os dados são imutáveis: é preciso ler o lançamento de novo para ver a mudança
    expect(isEntryPaidInMonth(expense(), app.currentMonth())).toBe(true);
  });

  it('should keep fixed expense paid status scoped to the selected month', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.currentMonth.set('2026-06');
    add(app, TransactionKind.FixedExpense, 'Internet', 120);

    const expense = () => app.entriesByKind()['fixed-expense'][0];

    app.togglePaidStatus(expense());

    expect(isEntryPaidInMonth(expense(), app.currentMonth())).toBe(true);

    app.currentMonth.set('2026-07');

    expect(isEntryPaidInMonth(expense(), app.currentMonth())).toBe(false);

    app.currentMonth.set('2026-06');

    expect(isEntryPaidInMonth(expense(), app.currentMonth())).toBe(true);
  });

  it('should not apply paid status to savings', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    add(app, TransactionKind.Saving, 'Reserva', 300);

    expect('paid' in app.entriesByKind().saving[0]).toBe(false);
  });

  it('should add to existing saving when same name is provided', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    add(app, TransactionKind.Saving, 'Computador', 500);

    expect(app.entriesByKind().saving.length).toBe(1);
    expect(app.entriesByKind().saving[0].value).toBe(500);

    add(app, TransactionKind.Saving, 'computador', 50);

    expect(app.entriesByKind().saving.length).toBe(1);
    expect(app.entriesByKind().saving[0].value).toBe(550);
  });

  it('cria as parcelas quando o usuário preenche o formulário de gasto variável', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const card: HTMLElement = fixture.nativeElement.querySelector('app-entry-card');

    function type(selector: string, text: string): void {
      const input = card.querySelector<HTMLInputElement>(selector)!;
      input.value = text;
      input.dispatchEvent(new Event('input'));
    }

    type('input[formControlName="description"]', 'Notebook');
    type('input[formControlName="value"]', '300000');
    card.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await fixture.whenStable();

    type('input[formControlName="installments"]', '3');
    card.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();

    const entries = fixture.componentInstance.entries();
    expect(entries.map((entry) => entry.value)).toEqual([1000, 1000, 1000]);
  });

  it('abre o modal de edição pela tela, com o valor já formatado', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const element: HTMLElement = fixture.nativeElement;

    add(app, TransactionKind.Income, 'Salario', 1500);
    await fixture.whenStable();

    const incomeCard = element.querySelectorAll('app-entry-card')[2];
    incomeCard.querySelector<HTMLButtonElement>('.list-toggle')!.click();
    await fixture.whenStable();
    incomeCard.querySelector<HTMLButtonElement>('[aria-label^="Editar"]')!.click();
    await fixture.whenStable();

    const dialog = element.querySelector('.edit-form')!.closest('dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector<HTMLInputElement>('[formControlName="value"]')!.value).toBe(
      '1.500,00',
    );
  });

  it('o menu lateral abre pelo botão e leva ao relatório', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const element: HTMLElement = fixture.nativeElement;
    await fixture.whenStable();

    element.querySelector<HTMLButtonElement>('[aria-label="Abrir menu"]')!.click();
    await fixture.whenStable();

    const menu = element.querySelector('.side-menu')!.closest('dialog')!;
    expect(menu.open).toBe(true);

    const reportButton = Array.from(menu.querySelectorAll<HTMLButtonElement>('.menu-item')).find(
      (button) => button.textContent?.includes('Relatório'),
    )!;
    reportButton.click();
    await fixture.whenStable();

    expect(app.menuOpen()).toBe(false);
    expect(app.reportOpen()).toBe(true);
    expect(element.querySelector('app-report-dialog')).not.toBeNull();
  });

  it('mostra quanto falta pagar no mês', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    add(app, TransactionKind.FixedExpense, 'Aluguel', 1000);
    add(app, TransactionKind.VariableExpense, 'Mercado', 300);

    expect(app.amountToPay()).toBe(1300);

    app.togglePaidStatus(app.entriesByKind()['fixed-expense'][0]);

    expect(app.amountToPay()).toBe(300);
  });

  it('permite desfazer a exclusão pelo aviso', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const toasts = TestBed.inject(ToastService);

    add(app, TransactionKind.VariableExpense, 'Notebook', 3000, 3);
    const before = app.entries();

    app.removeEntry(before[0].id);

    expect(app.entries()).toEqual([]);
    expect(toasts.toasts()[0]).toMatchObject({ message: '3 parcelas excluídas.' });

    toasts.toasts()[0].action!.run();

    expect(app.entries()).toEqual(before);
  });

  it('desfazer o encerramento de um gasto fixo volta a mostrá-lo nos meses seguintes', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const toasts = TestBed.inject(ToastService);

    app.currentMonth.set('2026-06');
    add(app, TransactionKind.FixedExpense, 'Aluguel', 1000);

    app.currentMonth.set('2026-08');
    app.removeEntry(app.entriesByKind()['fixed-expense'][0].id);
    expect(app.entriesByKind()['fixed-expense']).toHaveLength(0);

    toasts.toasts()[0].action!.run();

    expect(app.entriesByKind()['fixed-expense']).toHaveLength(1);
  });

  it('cofrinho continua nos meses seguintes e acumula; o saldo desconta só o guardado no mês', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.currentMonth.set('2026-10');
    add(app, TransactionKind.Saving, 'Viagem', 100);
    app.currentMonth.set('2026-11');
    add(app, TransactionKind.Saving, 'Viagem', 1000);

    expect(app.savingsCardEntries().map((entry) => entry.value)).toEqual([1100]);
    expect(app.summary().savings).toBe(1000);

    app.currentMonth.set('2026-10');
    expect(app.savingsCardEntries().map((entry) => entry.value)).toEqual([100]);
    expect(app.summary().savings).toBe(100);

    // retirado em dezembro: some de dezembro em diante, continua até novembro
    app.currentMonth.set('2026-12');
    expect(app.savingsCardEntries().map((entry) => entry.value)).toEqual([1100]);
    expect(app.summary().savings).toBe(0);
    app.removeEntry(app.savingsCardEntries()[0].id);
    expect(app.savingsCardEntries()).toEqual([]);

    app.currentMonth.set('2026-11');
    expect(app.savingsCardEntries().map((entry) => entry.value)).toEqual([1100]);
  });
});
