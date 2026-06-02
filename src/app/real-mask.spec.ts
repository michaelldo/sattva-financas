import { RealMask } from './real-mask';
import { NgControl } from '@angular/forms';

describe('RealMask', () => {
  it('should create an instance', () => {
    const directive = new RealMask({} as NgControl);
    expect(directive).toBeTruthy();
  });
});
