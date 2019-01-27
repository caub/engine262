import { surroundingAgent } from '../engine.mjs';
import {
  Assert,
  CreateArrayFromList,
  CreateIterResultObject,
} from '../abstract-ops/all.mjs';
import { Type, Value } from '../value.mjs';
import { BootstrapPrototype } from './Bootstrap.mjs';

function* SetIteratorPrototype_next(args, { thisValue }) {
  const O = thisValue;
  if (Type(O) !== 'Object') {
    return surroundingAgent.Throw('TypeError');
  }
  if (!('IteratedSet' in O && 'SetNextIndex' in O && 'SetIterationKind' in O)) {
    return surroundingAgent.Throw('TypeError');
  }
  const s = O.IteratedSet;
  let index = O.SetNextIndex;
  const itemKind = O.SetIterationKind;
  if (Type(s) === 'Undefined') {
    return yield* CreateIterResultObject(Value.undefined, Value.true);
  }
  Assert('SetData' in s);
  const entries = s.SetData;
  const numEntries = entries.length;
  while (index < numEntries) {
    const e = entries[index];
    index += 1;
    O.SetNextIndex = index;
    if (e !== undefined) {
      if (itemKind === 'key+value') {
        return yield* CreateIterResultObject(yield* CreateArrayFromList([e, e]), Value.false);
      }
      return yield* CreateIterResultObject(e, Value.false);
    }
  }
  O.IteratedSet = Value.undefined;
  return yield* CreateIterResultObject(Value.undefined, Value.true);
}

export function CreateSetIteratorPrototype(realmRec) {
  const proto = BootstrapPrototype(realmRec, [
    ['next', SetIteratorPrototype_next, 0],
  ], realmRec.Intrinsics['%IteratorPrototype%'], 'Set Iterator');

  realmRec.Intrinsics['%SetIteratorPrototype%'] = proto;
}
