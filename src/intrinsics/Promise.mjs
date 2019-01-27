import {
  surroundingAgent,
} from '../engine.mjs';
import {
  Type,
  Value,
  wellKnownSymbols,
} from '../value.mjs';
import {
  Assert,
  Call,
  CreateArrayFromList,
  CreateBuiltinFunction,
  CreateResolvingFunctions,
  GetIterator,
  Invoke,
  IsCallable,
  IsConstructor,
  IteratorClose,
  IteratorStep,
  IteratorValue,
  NewPromiseCapability,
  OrdinaryCreateFromConstructor,
  PromiseCapabilityRecord,
  PromiseResolve,
  SetFunctionLength,
} from '../abstract-ops/all.mjs';
import {
  AbruptCompletion, Completion,
  IfAbruptRejectPromise,
  Q,
  ReturnIfAbrupt,
  X,
} from '../completion.mjs';
import { BootstrapConstructor } from './Bootstrap.mjs';
import { msg } from '../helpers.mjs';

function* PromiseConstructor([executor = Value.undefined], { NewTarget }) {
  if (Type(NewTarget) === 'Undefined') {
    return surroundingAgent.Throw('TypeError', msg('NotAConstructor', NewTarget));
  }
  if (IsCallable(executor) === Value.false) {
    return surroundingAgent.Throw('TypeError', msg('NotAFunction', executor));
  }
  const promise = Q(yield* OrdinaryCreateFromConstructor(NewTarget, '%PromisePrototype%', [
    'PromiseState',
    'PromiseResult',
    'PromiseFulfillReactions',
    'PromiseRejectReactions',
    'PromiseIsHandled',
  ]));
  promise.PromiseState = 'pending';
  promise.PromiseFulfillReactions = [];
  promise.PromiseRejectReactions = [];
  promise.PromiseIsHandled = Value.false;
  const resolvingFunctions = yield* CreateResolvingFunctions(promise);
  const completion = yield* Call(executor, Value.undefined, [
    resolvingFunctions.Resolve, resolvingFunctions.Reject,
  ]);
  if (completion instanceof AbruptCompletion) {
    Q(yield* Call(resolvingFunctions.Reject, Value.undefined, [completion.Value]));
  }
  return promise;
}

// 25.6.4.1.2 #sec-promise.all-resolve-element-functions
function* PromiseAllResolveElementFunctions([x = Value.undefined]) {
  const F = surroundingAgent.activeFunctionObject;
  const alreadyCalled = F.AlreadyCalled;
  if (alreadyCalled.Value === true) {
    return Value.undefined;
  }
  alreadyCalled.Value = true;
  const index = F.Index;
  const values = F.Values;
  const promiseCapability = F.Capability;
  const remainingElementsCount = F.RemainingElements;
  values[index] = x;
  remainingElementsCount.Value -= 1;
  if (remainingElementsCount.Value === 0) {
    const valuesArray = yield* CreateArrayFromList(values);
    return Q(yield* Call(promiseCapability.Resolve, Value.undefined, [valuesArray]));
  }
  return Value.undefined;
}

// 25.6.4.1.1 #sec-performpromiseall
function* PerformPromiseAll(iteratorRecord, constructor, resultCapability) {
  Assert(IsConstructor(constructor) === Value.true);
  Assert(resultCapability instanceof PromiseCapabilityRecord);
  const values = [];
  const remainingElementsCount = { Value: 1 };
  let index = 0;
  while (true) {
    const next = yield* IteratorStep(iteratorRecord);
    if (next instanceof AbruptCompletion) {
      iteratorRecord.Done = Value.true;
    }
    ReturnIfAbrupt(next);
    if (next === Value.false) {
      iteratorRecord.Done = Value.true;
      remainingElementsCount.Value -= 1;
      if (remainingElementsCount.Value === 0) {
        const valuesArray = yield* CreateArrayFromList(values);
        Q(yield* Call(resultCapability.Resolve, Value.undefined, [valuesArray]));
      }
      return resultCapability.Promise;
    }
    const nextValue = yield* IteratorValue(next);
    if (nextValue instanceof AbruptCompletion) {
      iteratorRecord.Done = Value.true;
    }
    ReturnIfAbrupt(nextValue);
    values.push(Value.undefined);
    const nextPromise = Q(yield* Invoke(constructor, new Value('resolve'), [nextValue]));
    const steps = PromiseAllResolveElementFunctions;
    const resolveElement = CreateBuiltinFunction(steps, [
      'AlreadyCalled', 'Index', 'Values', 'Capability', 'RemainingElements',
    ]);
    X(yield* SetFunctionLength(resolveElement, new Value(1)));
    resolveElement.AlreadyCalled = { Value: false };
    resolveElement.Index = index;
    resolveElement.Values = values;
    resolveElement.Capability = resultCapability;
    resolveElement.RemainingElements = remainingElementsCount;
    remainingElementsCount.Value += 1;
    Q(yield* Invoke(nextPromise, new Value('then'), [resolveElement, resultCapability.Reject]));
    index += 1;
  }
}

function* Promise_all([iterable = Value.undefined], { thisValue }) {
  const C = thisValue;
  if (Type(C) !== 'Object') {
    return surroundingAgent.Throw('TypeError', 'Promise.all called on non-object');
  }
  const promiseCapability = Q(yield* NewPromiseCapability(C));
  const iteratorRecord = yield* GetIterator(iterable);
  IfAbruptRejectPromise(iteratorRecord, promiseCapability);
  let result = PerformPromiseAll(iteratorRecord, C, promiseCapability);
  if (result instanceof AbruptCompletion) {
    if (iteratorRecord.Done === Value.false) {
      result = yield* IteratorClose(iteratorRecord, result);
    }
    IfAbruptRejectPromise(result, promiseCapability);
  }
  return Completion(result);
}

function* PerformPromiseRace(iteratorRecord, constructor, resultCapability) {
  Assert(IsConstructor(constructor) === Value.true);
  Assert(resultCapability instanceof PromiseCapabilityRecord);
  while (true) {
    const next = yield* IteratorStep(iteratorRecord);
    if (next instanceof AbruptCompletion) {
      iteratorRecord.Done = Value.true;
    }
    ReturnIfAbrupt(next);
    if (next === Value.false) {
      iteratorRecord.Done = Value.true;
      return resultCapability.Promise;
    }
    const nextValue = yield* IteratorValue(next);
    if (nextValue instanceof AbruptCompletion) {
      iteratorRecord.Done = Value.true;
    }
    ReturnIfAbrupt(nextValue);
    const nextPromise = Q(yield* Invoke(constructor, new Value('resolve'), [nextValue]));
    Q(yield* Invoke(
      nextPromise,
      new Value('then'),
      [resultCapability.Resolve, resultCapability.Reject],
    ));
  }
}

function* Promise_race([iterable = Value.undefined], { thisValue }) {
  const C = thisValue;
  if (Type(C) !== 'Object') {
    return surroundingAgent.Throw('TypeError', 'Promise.race called on non-object');
  }
  const promiseCapability = Q(yield* NewPromiseCapability(C));
  const iteratorRecord = yield* GetIterator(iterable);
  IfAbruptRejectPromise(iteratorRecord, promiseCapability);
  let result = PerformPromiseRace(iteratorRecord, C, promiseCapability);
  if (result instanceof AbruptCompletion) {
    if (iteratorRecord.Done === Value.false) {
      result = yield* IteratorClose(iteratorRecord, result);
    }
    IfAbruptRejectPromise(result, promiseCapability);
  }
  return Completion(result);
}

function* Promise_reject([r = Value.undefined], { thisValue }) {
  const C = thisValue;
  if (Type(C) !== 'Object') {
    return surroundingAgent.Throw('TypeError', 'Promise.reject called on non-object');
  }
  const promiseCapability = Q(yield* NewPromiseCapability(C));
  Q(yield* Call(promiseCapability.Reject, Value.undefined, [r]));
  return promiseCapability.Promise;
}

function* Promise_resolve([x = Value.undefined], { thisValue }) {
  const C = thisValue;
  if (Type(C) !== 'Object') {
    return surroundingAgent.Throw('TypeError', 'Promise.resolve called on non-object');
  }
  return Q(yield* PromiseResolve(C, x));
}

function Promise_symbolSpecies(args, { thisValue }) {
  return thisValue;
}

export function CreatePromise(realmRec) {
  const promiseConstructor = BootstrapConstructor(realmRec, PromiseConstructor, 'Promise', 1, realmRec.Intrinsics['%PromisePrototype%'], [
    ['all', Promise_all, 1],
    ['race', Promise_race, 1],
    ['reject', Promise_reject, 1],
    ['resolve', Promise_resolve, 1],
    [wellKnownSymbols.species, [Promise_symbolSpecies]],
  ]);

  realmRec.Intrinsics['%Promise_all%'] = promiseConstructor.properties.get(new Value('all')).Value;
  realmRec.Intrinsics['%Promise_reject%'] = promiseConstructor.properties.get(new Value('reject')).Value;
  realmRec.Intrinsics['%Promise_resolve%'] = promiseConstructor.properties.get(new Value('resolve')).Value;

  realmRec.Intrinsics['%Promise%'] = promiseConstructor;
}
