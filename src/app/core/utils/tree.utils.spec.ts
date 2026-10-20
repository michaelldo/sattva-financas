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

  it('com spaced, separa os irmãos com uma linha de tronco', () => {
    const lines = renderTree(
      [
        {
          label: 'Outubro',
          spaceChildren: true,
          children: [{ label: 'Entradas', children: [{ label: 'Salário' }] }, { label: 'Saldo' }],
        },
        { label: 'Total' },
      ],
      '',
      true,
    );

    expect(lines).toEqual([
      '├── Outubro',
      '│   ├── Entradas',
      '│   │   └── Salário',
      '│   │',
      '│   └── Saldo',
      '│',
      '└── Total',
    ]);
  });
});
