import { renderTree } from './tree.utils';

describe('renderTree', () => {
  it('desenha níveis com os galhos certos', () => {
    const lines = renderTree([
      { label: 'Outubro', children: [{ label: 'Salário' }, { label: 'Aluguel' }] },
      { label: 'Total', children: [{ label: 'Saldo' }] },
    ]);

    expect(lines).toEqual([
      '├── Outubro',
      '│   ├── Salário',
      '│   └── Aluguel',
      '└── Total',
      '    └── Saldo',
    ]);
  });

  it('lista vazia não desenha nada', () => {
    expect(renderTree([])).toEqual([]);
  });
});
