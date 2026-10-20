import { Validators } from '@angular/forms';
import { MAX_DESCRIPTION_LENGTH } from '../../core/utils/entry-parser';

export const MAX_INSTALLMENTS = 120;

export const DESCRIPTION_VALIDATORS = [
  Validators.required,
  Validators.pattern(/\S/),
  Validators.maxLength(MAX_DESCRIPTION_LENGTH),
];

export const VALUE_VALIDATORS = [Validators.required, Validators.min(0.01)];

export const INSTALLMENTS_VALIDATORS = [
  Validators.required,
  Validators.min(1),
  Validators.max(MAX_INSTALLMENTS),
];
