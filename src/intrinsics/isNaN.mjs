import {
  ToNumber,
  CreateBuiltinFunction,
} from '../abstract-ops/all.mjs';
import { Value } from '../value.mjs';
import { Q } from '../completion.mjs';
import { setFunctionProps } from './Bootstrap.mjs';

function* IsNaN([number = Value.undefined]) {
  const num = Q(yield* ToNumber(number));
  if (num.isNaN()) {
    return Value.true;
  }
  return Value.false;
}

export function CreateIsNaN(realmRec) {
  const fn = CreateBuiltinFunction(IsNaN, [], realmRec);
  setFunctionProps(fn, new Value('isNaN'), new Value(1));
  realmRec.Intrinsics['%isNaN%'] = fn;
}
