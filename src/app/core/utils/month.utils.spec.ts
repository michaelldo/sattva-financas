import { addMonths, getCurrentMonth, monthRange } from './month.utils';

describe('month.utils', () => {
  it('usa o mês local, mesmo à noite no último dia do mês', () => {
    const lastDayNight = new Date(2026, 9, 31, 22, 30);
    expect(getCurrentMonth(lastDayNight)).toBe('2026-10');
  });

  it('soma meses vorando o ano', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });

  it('lista os meses de um período, virando o ano', () => {
    expect(monthRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(monthRange('2026-10', '2026-10')).toEqual(['2026-10']);
    expect(monthRange('2026-10', '2026-09')).toEqual([]);
  });
});
