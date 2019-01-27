import {
  surroundingAgent,
} from '../engine.mjs';
import {
  AbruptCompletion,
  Q,
  ThrowCompletion, X,
} from '../completion.mjs';
import {
  ArrayCreate,
  Assert,
  Call,
  Construct,
  CreateDataProperty,
  CreateDataPropertyOrThrow,
  Get,
  GetIterator,
  GetMethod,
  GetPrototypeFromConstructor,
  IsArray,
  IsCallable,
  IsConstructor,
  IteratorClose,
  IteratorStep,
  IteratorValue,
  Set,
  ToLength,
  ToObject,
  ToString,
  ToUint32,
} from '../abstract-ops/all.mjs';
import {
  Type,
  Value,
  wellKnownSymbols,
} from '../value.mjs';
import { OutOfRange, msg } from '../helpers.mjs';
import { BootstrapConstructor } from './Bootstrap.mjs';

// 22.1.1 #sec-array-constructor
function* ArrayConstructor(argumentsList, { NewTarget }) {
  const numberOfArgs = argumentsList.length;
  if (numberOfArgs === 0) {
    // 22.1.1.1 #sec-array-constructor-array
    Assert(numberOfArgs === 0);
    if (Type(NewTarget) === 'Undefined') {
      NewTarget = surroundingAgent.activeFunctionObject;
    }
    const proto = yield* GetPrototypeFromConstructor(NewTarget, '%ArrayPrototype%');
    return yield* ArrayCreate(new Value(0), proto);
  } else if (numberOfArgs === 1) {
    // 22.1.1.2 #sec-array-len
    const [len] = argumentsList;
    Assert(numberOfArgs === 1);
    if (Type(NewTarget) === 'Undefined') {
      NewTarget = surroundingAgent.activeFunctionObject;
    }
    const proto = yield* GetPrototypeFromConstructor(NewTarget, '%ArrayPrototype%');
    const array = yield* ArrayCreate(new Value(0), proto);
    let intLen;
    if (Type(len) !== 'Number') {
      const defineStatus = X(yield* CreateDataProperty(array, new Value('0'), len));
      Assert(defineStatus === Value.true);
      intLen = new Value(1);
    } else {
      intLen = yield* ToUint32(len);
      if (intLen.numberValue() !== len.numberValue()) {
        return surroundingAgent.Throw('RangeError');
      }
    }
    yield* Set(array, new Value('length'), intLen, Value.true);
    return array;
  } else if (numberOfArgs >= 2) {
    // 22.1.1.3 #sec-array-items
    const items = argumentsList;
    Assert(numberOfArgs >= 2);
    if (Type(NewTarget) === 'Undefined') {
      NewTarget = surroundingAgent.activeFunctionObject;
    }
    const proto = yield* GetPrototypeFromConstructor(NewTarget, '%ArrayPrototype%');
    const array = yield* ArrayCreate(new Value(0), proto);
    let k = 0;
    while (k < numberOfArgs) {
      const Pk = yield* ToString(new Value(k));
      const itemK = items[k];
      const defineStatus = X(yield* CreateDataProperty(array, Pk, itemK));
      Assert(defineStatus === Value.true);
      k += 1;
    }
    Assert(X(yield* Get(array, new Value('length'))).numberValue() === numberOfArgs);
    return array;
  }

  throw new OutOfRange('ArrayConstructor', numberOfArgs);
}

// 22.1.2.1 #sec-array.from
function* Array_from([items = Value.undefined, mapfn = Value.undefined, thisArg], { thisValue }) {
  const C = thisValue;
  let mapping;
  let T;
  let A;
  if (mapfn === Value.undefined) {
    mapping = false;
  } else {
    if (IsCallable(mapfn) === Value.false) {
      return surroundingAgent.Throw('TypeError', msg('NotAFunction', mapfn));
    }
    if (thisArg !== undefined) {
      T = thisArg;
    } else {
      T = Value.undefined;
    }
    mapping = true;
  }
  const usingIterator = Q(yield* GetMethod(items, wellKnownSymbols.iterator));
  if (usingIterator !== Value.undefined) {
    if (IsConstructor(C) === Value.true) {
      A = Q(yield* Construct(C));
    } else {
      A = X(yield* ArrayCreate(new Value(0)));
    }
    const iteratorRecord = Q(yield* GetIterator(items, 'sync', usingIterator));
    let k = 0;
    while (true) { // eslint-disable-line no-constant-condition
      if (k >= (2 ** 53) - 1) {
        const error = new ThrowCompletion(surroundingAgent.Throw('TypeError', msg('ArrayPastSafeLength')).Value);
        return Q(yield* IteratorClose(iteratorRecord, error));
      }
      const Pk = X(yield* ToString(new Value(k)));
      const next = Q(yield* IteratorStep(iteratorRecord));
      if (next === Value.false) {
        Q(yield* Set(A, new Value('length'), new Value(k), Value.true));
        return A;
      }
      const nextValue = Q(yield* IteratorValue(next));
      let mappedValue;
      if (mapping) {
        mappedValue = yield* Call(mapfn, T, [nextValue, new Value(k)]);
        if (mappedValue instanceof AbruptCompletion) {
          return Q(yield* IteratorClose(iteratorRecord, mappedValue));
        }
        mappedValue = mappedValue.Value;
      } else {
        mappedValue = nextValue;
      }
      const defineStatus = yield* CreateDataPropertyOrThrow(A, Pk, mappedValue);
      if (defineStatus instanceof AbruptCompletion) {
        return Q(yield* IteratorClose(iteratorRecord, defineStatus));
      }
      k += 1;
    }
  }
  const arrayLike = X(yield* ToObject(items));
  const lenProp = Q(yield* Get(arrayLike, new Value('length')));
  const len = Q(yield* ToLength(lenProp));
  if (IsConstructor(C) === Value.true) {
    A = Q(yield* Construct(C, [len]));
  } else {
    A = Q(yield* ArrayCreate(len));
  }
  let k = 0;
  while (k < len.numberValue()) {
    const Pk = X(yield* ToString(new Value(k)));
    const kValue = Q(yield* Get(arrayLike, Pk));
    let mappedValue;
    if (mapping === true) {
      mappedValue = Q(yield* Call(mapfn, T, [kValue, new Value(k)]));
    } else {
      mappedValue = kValue;
    }
    Q(yield* CreateDataPropertyOrThrow(A, Pk, mappedValue));
    k += 1;
  }
  Q(yield* Set(A, new Value('length'), len, Value.true));
  return A;
}

// 22.1.2.2 #sec-array.isarray
function* Array_isArray([arg = Value.undefined]) {
  return Q(IsArray(arg));
}

// 22.1.2.3 #sec-array.of
function* Array_of(items, { thisValue }) {
  const len = items.length;
  // Let items be the List of arguments passed to this function.
  const C = thisValue;
  let A;
  if (IsConstructor(C) === Value.true) {
    A = Q(yield* Construct(C, [new Value(len)]));
  } else {
    A = Q(yield* ArrayCreate(new Value(len)));
  }
  let k = 0;
  while (k < len) {
    const kValue = items[k];
    const Pk = X(yield* ToString(new Value(k)));
    Q(yield* CreateDataPropertyOrThrow(A, Pk, kValue));
    k += 1;
  }
  Q(yield* Set(A, new Value('length'), new Value(len), Value.true));
  return A;
}

// 22.1.2.5 #sec-get-array-@@species
function* Array_speciesGetter(args, { thisValue }) {
  return thisValue;
}

export function CreateArray(realmRec) {
  const proto = realmRec.Intrinsics['%ArrayPrototype%'];

  const cons = BootstrapConstructor(realmRec, ArrayConstructor, 'Array', 1, proto, [
    ['from', Array_from, 1],
    ['isArray', Array_isArray, 1],
    ['of', Array_of, 0],
    [wellKnownSymbols.species, [Array_speciesGetter]],
  ]);

  realmRec.Intrinsics['%Array%'] = cons;
}
