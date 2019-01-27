import { surroundingAgent } from '../engine.mjs';
import {
  Assert,
  Call,
  CreateBuiltinFunction,
  Invoke,
  IsCallable,
  IsConstructor,
  IsPromise,
  NewPromiseCapability,
  PerformPromiseThen,
  PromiseResolve,
  SetFunctionLength,
  SpeciesConstructor,
} from '../abstract-ops/all.mjs';
import { Type, Value } from '../value.mjs';
import { Q, ThrowCompletion } from '../completion.mjs';
import { BootstrapPrototype } from './Bootstrap.mjs';
import { msg } from '../helpers.mjs';

function* PromiseProto_catch([onRejected = Value.undefined], { thisValue }) {
  const promise = thisValue;
  return Q(yield* Invoke(promise, new Value('then'), [Value.undefined, onRejected]));
}

function* ThenFinallyFunctions([value = Value.undefined]) {
  const F = surroundingAgent.activeFunctionObject;
  const onFinally = F.OnFinally;
  Assert(IsCallable(onFinally) === Value.true);
  const result = Q(yield* Call(onFinally, Value.undefined));
  const C = F.Constructor;
  Assert(IsConstructor(C) === Value.true);
  const promise = Q(yield* PromiseResolve(C, result));
  const valueThunk = CreateBuiltinFunction(() => value, []);
  yield* SetFunctionLength(valueThunk, new Value(0));
  return Q(yield* Invoke(promise, new Value('then'), [valueThunk]));
}

function* CatchFinallyFunctions([reason = Value.undefined]) {
  const F = surroundingAgent.activeFunctionObject;
  const onFinally = F.OnFinally;
  Assert(IsCallable(onFinally) === Value.true);
  const result = Q(yield* Call(onFinally, Value.undefined));
  const C = F.Constructor;
  Assert(IsConstructor(C) === Value.true);
  const promise = Q(yield* PromiseResolve(C, result));
  const thrower = CreateBuiltinFunction(() => new ThrowCompletion(reason), []);
  yield* SetFunctionLength(thrower, new Value(0));
  return Q(yield* Invoke(promise, new Value('then'), [thrower]));
}

function* PromiseProto_finally([onFinally = Value.undefined], { thisValue }) {
  const promise = thisValue;
  if (Type(promise) !== 'Object') {
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'Promise', promise));
  }
  const C = yield* SpeciesConstructor(promise, surroundingAgent.intrinsic('%Promise%'));
  Assert(IsConstructor(C) === Value.true);
  let thenFinally;
  let catchFinally;
  if (IsCallable(onFinally) === Value.false) {
    thenFinally = onFinally;
    catchFinally = onFinally;
  } else {
    const stepsThenFinally = ThenFinallyFunctions;
    thenFinally = CreateBuiltinFunction(stepsThenFinally, ['Constructor', 'OnFinally']);
    yield* SetFunctionLength(thenFinally, new Value(1));
    thenFinally.Constructor = C;
    thenFinally.OnFinally = onFinally;
    const stepsCatchFinally = CatchFinallyFunctions;
    catchFinally = CreateBuiltinFunction(stepsCatchFinally, ['Constructor', 'OnFinally']);
    yield* SetFunctionLength(catchFinally, new Value(1));
    catchFinally.Constructor = C;
    catchFinally.OnFinally = onFinally;
  }
  return Q(yield* Invoke(promise, new Value('then'), [thenFinally, catchFinally]));
}

function* PromiseProto_then(
  [onFulfilled = Value.undefined, onRejected = Value.undefined],
  { thisValue },
) {
  const promise = thisValue;
  if (IsPromise(promise) === Value.false) {
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'Promise', promise));
  }
  const C = Q(yield* SpeciesConstructor(promise, surroundingAgent.intrinsic('%Promise%')));
  const resultCapability = Q(yield* NewPromiseCapability(C));
  return yield* PerformPromiseThen(promise, onFulfilled, onRejected, resultCapability);
}

export function CreatePromisePrototype(realmRec) {
  const proto = BootstrapPrototype(realmRec, [
    ['catch', PromiseProto_catch, 1],
    ['finally', PromiseProto_finally, 1],
    ['then', PromiseProto_then, 2],
  ], realmRec.Intrinsics['%ObjectPrototype%'], 'Promise');

  realmRec.Intrinsics['%PromiseProto_then%'] = proto.properties.get(new Value('then')).Value;

  realmRec.Intrinsics['%PromisePrototype%'] = proto;
}
