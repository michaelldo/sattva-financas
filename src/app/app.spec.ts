import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { appConfig } from './app.config';

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

    app.incomeForm.setValue({ description: 'Salario', value: 2500 });
    app.addIncome();

    expect(app.summary().income).toBe(2500);
    expect(app.summary().balance).toBe(2500);
  });

  it('should remove the selected installment and the following installments', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.variableExpenseForm.setValue({
      description: 'Notebook',
      value: 3000,
      isInstallment: true,
      installments: 3,
    });
    app.addVariableExpense();

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
    app.fixedExpenseForm.setValue({ description: 'Aluguel', value: 1000 });
    app.addFixedExpense();

    expect(app.entriesByKind('fixed-expense').length).toBe(1);

    app.currentMonth.set('2026-07');
    app.removeEntry(app.entriesByKind('fixed-expense')[0].id);

    expect(app.entriesByKind('fixed-expense').length).toBe(0);

    app.currentMonth.set('2026-06');

    expect(app.entriesByKind('fixed-expense').length).toBe(1);

    app.currentMonth.set('2026-08');

    expect(app.entriesByKind('fixed-expense').length).toBe(0);
  });

  it('should show fixed expenses only from the month they were created', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.currentMonth.set('2026-07');
    app.fixedExpenseForm.setValue({ description: 'Aluguel ajustado', value: 1100 });
    app.addFixedExpense();

    expect(app.entriesByKind('fixed-expense').length).toBe(1);

    app.currentMonth.set('2026-06');

    expect(app.entriesByKind('fixed-expense').length).toBe(0);
  });

  it('should create expenses as unpaid and toggle paid status', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.fixedExpenseForm.setValue({ description: 'Internet', value: 120 });
    app.addFixedExpense();

    const expense = app.entriesByKind('fixed-expense')[0];

    expect(app.isEntryPaid(expense)).toBe(false);

    app.togglePaidStatus(expense);

    expect(app.isEntryPaid(app.entriesByKind('fixed-expense')[0])).toBe(true);
  });

  it('should keep fixed expense paid status scoped to the selected month', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.currentMonth.set('2026-06');
    app.fixedExpenseForm.setValue({ description: 'Internet', value: 120 });
    app.addFixedExpense();

    const expense = app.entriesByKind('fixed-expense')[0];

    app.togglePaidStatus(expense);

    expect(app.isEntryPaid(app.entriesByKind('fixed-expense')[0])).toBe(true);

    app.currentMonth.set('2026-07');

    expect(app.isEntryPaid(app.entriesByKind('fixed-expense')[0])).toBe(false);

    app.currentMonth.set('2026-06');

    expect(app.isEntryPaid(app.entriesByKind('fixed-expense')[0])).toBe(true);
  });

  it('should not apply paid status to savings', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.savingForm.setValue({ description: 'Reserva', value: 300 });
    app.addSaving();

    expect('paid' in app.entriesByKind('saving')[0]).toBe(false);
  });

  it('should add to existing saving when same name is provided', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.savingForm.setValue({ description: 'Computador', value: 500 });
    app.addSaving();

    expect(app.entriesByKind('saving').length).toBe(1);
    expect(app.entriesByKind('saving')[0].value).toBe(500);

    app.savingForm.setValue({ description: 'computador', value: 50 });
    app.addSaving();

    expect(app.entriesByKind('saving').length).toBe(1);
    expect(app.entriesByKind('saving')[0].value).toBe(550);
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
});
