import {
  CreateBuiltinFunction,
  ToString,
} from '../abstract-ops/all.mjs';
import { Q } from '../completion.mjs';
import { Value } from '../value.mjs';
import { searchNotStrWhiteSpaceChar } from '../grammar/numeric-string.mjs';
import { MV_StrDecimalLiteral } from '../runtime-semantics/all.mjs';
import { setFunctionProps } from './Bootstrap.mjs';

function* ParseFloat([string = Value.undefined]) {
  const inputString = Q(yield* ToString(string)).stringValue();
  const trimmedString = inputString.slice(searchNotStrWhiteSpaceChar(inputString));
  const mathFloat = MV_StrDecimalLiteral(trimmedString, true);
  // MV_StrDecimalLiteral handles -0 automatically.
  return mathFloat;
}

export function CreateParseFloat(realmRec) {
  const fn = CreateBuiltinFunction(ParseFloat, [], realmRec);
  setFunctionProps(fn, new Value('parseFloat'), new Value(1));
  realmRec.Intrinsics['%parseFloat%'] = fn;
}
