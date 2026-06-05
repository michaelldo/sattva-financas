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

    const secondInstallment = app.entries().find((entry) => entry.installment?.current === 2);

    expect(secondInstallment).toBeTruthy();

    app.removeEntry(secondInstallment!.id);

    expect(app.entries().map((entry) => entry.installment?.current)).toEqual([1]);
  });

  it('should hide fixed expenses from the selected month forward when removed', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.updateCurrentMonth('2026-06');
    app.fixedExpenseForm.setValue({ description: 'Aluguel', value: 1000 });
    app.addFixedExpense();

    expect(app.entriesByKind('fixed-expense').length).toBe(1);

    app.updateCurrentMonth('2026-07');
    app.removeEntry(app.entriesByKind('fixed-expense')[0].id);

    expect(app.entriesByKind('fixed-expense').length).toBe(0);

    app.updateCurrentMonth('2026-06');

    expect(app.entriesByKind('fixed-expense').length).toBe(1);

    app.updateCurrentMonth('2026-08');

    expect(app.entriesByKind('fixed-expense').length).toBe(0);
  });

  it('should show fixed expenses only from the month they were created', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.updateCurrentMonth('2026-07');
    app.fixedExpenseForm.setValue({ description: 'Aluguel ajustado', value: 1100 });
    app.addFixedExpense();

    expect(app.entriesByKind('fixed-expense').length).toBe(1);

    app.updateCurrentMonth('2026-06');

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

    app.updateCurrentMonth('2026-06');
    app.fixedExpenseForm.setValue({ description: 'Internet', value: 120 });
    app.addFixedExpense();

    const expense = app.entriesByKind('fixed-expense')[0];

    app.togglePaidStatus(expense);

    expect(app.isEntryPaid(app.entriesByKind('fixed-expense')[0])).toBe(true);

    app.updateCurrentMonth('2026-07');

    expect(app.isEntryPaid(app.entriesByKind('fixed-expense')[0])).toBe(false);

    app.updateCurrentMonth('2026-06');

    expect(app.isEntryPaid(app.entriesByKind('fixed-expense')[0])).toBe(true);
  });

  it('should not apply paid status to savings', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.savingForm.setValue({ description: 'Reserva', value: 300 });
    app.addSaving();

    expect(app.entriesByKind('saving')[0].paid).toBeUndefined();
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
});
