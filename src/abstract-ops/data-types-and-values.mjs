import { Type, Value } from '../value.mjs';
import { CanonicalNumericIndexString } from './all.mjs';
import { X } from '../completion.mjs';

// This file covers predicates defined in
// 6 #sec-ecmascript-data-types-and-values

// 6.1.7 #integer-index
export function isIntegerIndex(V) {
  if (Type(V) !== 'String') {
    return false;
  }
  const numeric = X(CanonicalNumericIndexString(V));
  if (numeric === Value.undefined) {
    return false;
  }
  if (Object.is(numeric.numberValue(), +0)) {
    return true;
  }
  return numeric.numberValue() > 0 && Number.isSafeInteger(numeric.numberValue());
}

// 6.1.7 #array-index
export function isArrayIndex(V) {
  if (Type(V) !== 'String') {
    return false;
  }
  const numeric = X(CanonicalNumericIndexString(V));
  if (numeric === Value.undefined) {
    return false;
  }
  if (Object.is(numeric.numberValue(), +0)) {
    return true;
  }
  return numeric.numberValue() > 0 && numeric.numberValue() < (2 ** 32) - 1;
}
