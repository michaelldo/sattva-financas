import { addMonths, getCurrentMonth } from './month.utils';

describe('month.utils', () => {
  it('usa o mês local, mesmo à noite no último dia do mês', () =>{
    const lastDayNight = new Date(2026, 9, 31, 22, 30);
    expect(getCurrentMonth(lastDayNight)).toBe('2026-10');
  });

  it('soma meses vorando o ano', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });
})
