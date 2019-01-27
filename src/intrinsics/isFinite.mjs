import {
  ToNumber,
  CreateBuiltinFunction,
} from '../abstract-ops/all.mjs';
import { Value } from '../value.mjs';
import { Q } from '../completion.mjs';
import { setFunctionProps } from './Bootstrap.mjs';

function* IsFinite([number = Value.undefined]) {
  const num = Q(yield* ToNumber(number));
  if (num.isNaN() || num.isInfinity()) {
    return Value.false;
  }
  return Value.true;
}

export function CreateIsFinite(realmRec) {
  const fn = CreateBuiltinFunction(IsFinite, [], realmRec);
  setFunctionProps(fn, new Value('isFinite'), new Value(1));
  realmRec.Intrinsics['%isFinite%'] = fn;
}
