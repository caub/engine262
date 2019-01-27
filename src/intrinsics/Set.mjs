import { surroundingAgent } from '../engine.mjs';
import {
  Call,
  Get,
  GetIterator,
  IsCallable,
  IteratorClose,
  IteratorStep,
  IteratorValue,
  OrdinaryCreateFromConstructor,
} from '../abstract-ops/all.mjs';
import {
  Type,
  Value,
  wellKnownSymbols,
} from '../value.mjs';
import { AbruptCompletion, Q } from '../completion.mjs';
import { BootstrapConstructor } from './Bootstrap.mjs';
import { msg } from '../helpers.mjs';

function* SetConstructor([iterable], { NewTarget }) {
  if (Type(NewTarget) === 'Undefined') {
    return surroundingAgent.Throw('TypeError', msg('NotAConstructor', NewTarget));
  }
  const set = Q(yield* OrdinaryCreateFromConstructor(NewTarget, '%SetPrototype%', ['SetData']));
  set.SetData = [];
  if (iterable === undefined || Type(iterable) === 'Undefined' || Type(iterable) === 'Null') {
    return set;
  }
  const adder = Q(yield* Get(set, new Value('add')));
  if (IsCallable(adder) === Value.false) {
    return surroundingAgent.Throw('TypeError');
  }
  const iteratorRecord = Q(yield* GetIterator(iterable));

  while (true) {
    const next = Q(yield* IteratorStep(iteratorRecord));
    if (next === Value.false) {
      return set;
    }
    const nextValue = Q(yield* IteratorValue(next));
    const status = yield* Call(adder, set, [nextValue]);
    if (status instanceof AbruptCompletion) {
      return Q(yield* IteratorClose(iteratorRecord, status));
    }
  }
}

function Set_speciesGetter(args, { thisValue }) {
  return thisValue;
}

export function CreateSet(realmRec) {
  const setConstructor = BootstrapConstructor(realmRec, SetConstructor, 'Set', 0, realmRec.Intrinsics['%SetPrototype%'], [
    [wellKnownSymbols.species, [Set_speciesGetter]],
  ]);

  realmRec.Intrinsics['%Set%'] = setConstructor;
}
