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
    app.fixedExpenseForm.setValue({ description: 'Aluguel ajustado', value: 1100 });
    app.addFixedExpense();

    expect(app.entriesByKind()['fixed-expense'].length).toBe(1);

    app.currentMonth.set('2026-06');

    expect(app.entriesByKind()['fixed-expense'].length).toBe(0);
  });

  it('should create expenses as unpaid and toggle paid status', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.fixedExpenseForm.setValue({ description: 'Internet', value: 120 });
    app.addFixedExpense();

    const expense = app.entriesByKind()['fixed-expense'][0];

    expect(app.isEntryPaid(expense)).toBe(false);

    app.togglePaidStatus(expense);

    expect(app.isEntryPaid(app.entriesByKind()['fixed-expense'][0])).toBe(true);
  });

  it('should keep fixed expense paid status scoped to the selected month', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.currentMonth.set('2026-06');
    app.fixedExpenseForm.setValue({ description: 'Internet', value: 120 });
    app.addFixedExpense();

    const expense = app.entriesByKind()['fixed-expense'][0];

    app.togglePaidStatus(expense);

    expect(app.isEntryPaid(app.entriesByKind()['fixed-expense'][0])).toBe(true);

    app.currentMonth.set('2026-07');

    expect(app.isEntryPaid(app.entriesByKind()['fixed-expense'][0])).toBe(false);

    app.currentMonth.set('2026-06');

    expect(app.isEntryPaid(app.entriesByKind()['fixed-expense'][0])).toBe(true);
  });

  it('should not apply paid status to savings', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.savingForm.setValue({ description: 'Reserva', value: 300 });
    app.addSaving();

    expect('paid' in app.entriesByKind().saving[0]).toBe(false);
  });

  it('should add to existing saving when same name is provided', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.savingForm.setValue({ description: 'Computador', value: 500 });
    app.addSaving();

    expect(app.entriesByKind().saving.length).toBe(1);
    expect(app.entriesByKind().saving[0].value).toBe(500);

    app.savingForm.setValue({ description: 'computador', value: 50 });
    app.addSaving();

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

  it('edita descrição e valor de um lançamento existente', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.incomeForm.setValue({ description: 'Salario', value: 2500 });
    app.addIncome();
    const income = app.entriesByKind().income[0];

    app.startEdit(income);
    expect(app.editForm.getRawValue()).toMatchObject({ description: 'Salario', value: 2500 });

    app.editForm.patchValue({ description: 'Salário', value: 2800 });
    app.saveEdit();

    expect(app.entriesByKind().income[0]).toMatchObject({
      id: income.id,
      description: 'Salário',
      value: 2800,
    });
    expect(app.summary().income).toBe(2800);
    expect(app.editingEntry()).toBeNull();
  });

  it('não salva a edição com valor inválido', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.incomeForm.setValue({ description: 'Salario', value: 2500 });
    app.addIncome();
    app.startEdit(app.entriesByKind().income[0]);

    app.editForm.patchValue({ description: 'Salario', value: null });
    app.saveEdit();

    expect(app.entriesByKind().income[0].value).toBe(2500);
    expect(app.editingEntry()).not.toBeNull();
  });

  it('abre o modal de edição pela tela, com o valor já formatado', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const element: HTMLElement = fixture.nativeElement;

    app.incomeForm.setValue({ description: 'Salario', value: 1500 });
    app.addIncome();
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

  it('ao editar uma parcela, edita a compra inteira (valor total e quantidade)', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.variableExpenseForm.setValue({
      description: 'Notebook',
      value: 3000,
      isInstallment: true,
      installments: 3,
    });
    app.addVariableExpense();

    app.startEdit(app.entriesByKind()['variable-expense'][0]);
    expect(app.editForm.getRawValue()).toEqual({
      description: 'Notebook',
      value: 3000,
      installments: 3,
    });

    app.editForm.patchValue({ value: 2000, installments: 4 });
    app.saveEdit();

    const values = app
      .entries()
      .filter((entry) => entry.kind === 'variable-expense')
      .map((entry) => entry.value);
    expect(values).toEqual([500, 500, 500, 500]);
  });

  it('editar um gasto fixo vale só do mês atual em diante', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.currentMonth.set('2026-01');
    app.fixedExpenseForm.setValue({ description: 'Aluguel', value: 1000 });
    app.addFixedExpense();

    app.currentMonth.set('2026-03');
    app.startEdit(app.entriesByKind()['fixed-expense'][0]);
    app.editForm.patchValue({ value: 1200 });
    app.saveEdit();

    expect(app.summary().fixedExpenses).toBe(1200);

    app.currentMonth.set('2026-02');
    expect(app.summary().fixedExpenses).toBe(1000);

    app.currentMonth.set('2026-08');
    expect(app.summary().fixedExpenses).toBe(1200);
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
  });

  it('mostra quanto falta pagar no mês', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.fixedExpenseForm.setValue({ description: 'Aluguel', value: 1000 });
    app.addFixedExpense();
    app.variableExpenseForm.setValue({
      description: 'Mercado',
      value: 300,
      isInstallment: false,
      installments: 1,
    });
    app.addVariableExpense();

    expect(app.amountToPay()).toBe(1300);

    app.togglePaidStatus(app.entriesByKind()['fixed-expense'][0]);

    expect(app.amountToPay()).toBe(300);
  });
});
