import { surroundingAgent } from '../engine.mjs';
import {
  Assert,
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
import {
  AbruptCompletion,
  ThrowCompletion,
  Q,
} from '../completion.mjs';
import { BootstrapConstructor } from './Bootstrap.mjs';
import { msg } from '../helpers.mjs';

export function* AddEntriesFromIterable(target, iterable, adder) {
  if (IsCallable(adder) === Value.false) {
    return surroundingAgent.Throw('TypeError');
  }
  Assert(iterable && Type(iterable) !== 'Undefined' && Type(iterable) !== 'Null');
  const iteratorRecord = Q(yield* GetIterator(iterable));
  while (true) {
    const next = Q(yield* IteratorStep(iteratorRecord));
    if (next === Value.false) {
      return target;
    }
    const nextItem = Q(yield* IteratorValue(next));
    if (Type(nextItem) !== 'Object') {
      const error = new ThrowCompletion(surroundingAgent.Throw('TypeError').Value);
      return Q(yield* IteratorClose(iteratorRecord, error));
    }
    const k = yield* Get(nextItem, new Value('0'));
    if (k instanceof AbruptCompletion) {
      return Q(yield* IteratorClose(iteratorRecord, k));
    }
    const v = yield* Get(nextItem, new Value('1'));
    if (v instanceof AbruptCompletion) {
      return Q(yield* IteratorClose(iteratorRecord, v));
    }
    const status = yield* Call(adder, target, [k.Value, v.Value]);
    if (status instanceof AbruptCompletion) {
      return Q(yield* IteratorClose(iteratorRecord, status));
    }
  }
}

function* MapConstructor([iterable], { NewTarget }) {
  if (Type(NewTarget) === 'Undefined') {
    return surroundingAgent.Throw('TypeError', msg('NotAConstructor', NewTarget));
  }
  const map = Q(yield* OrdinaryCreateFromConstructor(NewTarget, '%MapPrototype%', ['MapData']));
  map.MapData = [];
  if (iterable === undefined || Type(iterable) === 'Undefined' || Type(iterable) === 'Null') {
    return map;
  }
  const adder = Q(yield* Get(map, new Value('set')));
  return Q(AddEntriesFromIterable(map, iterable, adder));
}

function Map_speciesGetter(args, { thisValue }) {
  return thisValue;
}

export function CreateMap(realmRec) {
  const mapConstructor = BootstrapConstructor(realmRec, MapConstructor, 'Map', 0, realmRec.Intrinsics['%MapPrototype%'], [
    [wellKnownSymbols.species, [Map_speciesGetter]],
  ]);

  realmRec.Intrinsics['%Map%'] = mapConstructor;
}
