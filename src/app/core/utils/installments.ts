export function splitIntoInstallments(total: number, count: number): number[]{
  const totalCents = Math.round(total * 100);
  const basecents = Math.floor(totalCents / count);
  const remainderCents = totalCents - basecents * count;

  return Array.from({ length: count}, (_, index) =>{
    const extraCent = index < remainderCents ? 1 : 0;
    return (basecents + extraCent) / 100;
  });
}
