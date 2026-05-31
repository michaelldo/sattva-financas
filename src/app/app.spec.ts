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
    expect(compiled.querySelector('h1')?.textContent).toContain('Balanco');
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
});
