import { surroundingAgent } from '../engine.mjs';
import {
  AsyncFromSyncIteratorContinuation,
  Call,
  CreateIterResultObject,
  GetMethod,
  IteratorNext,
  NewPromiseCapability,
} from '../abstract-ops/all.mjs';
import { Type, Value } from '../value.mjs';
import { IfAbruptRejectPromise, X } from '../completion.mjs';
import { BootstrapPrototype } from './Bootstrap.mjs';

// 25.1.4.2.1 #sec-%asyncfromsynciteratorprototype%.next
function* AsyncFromSyncIteratorPrototype_next([value = Value.undefined], { thisValue }) {
  const O = thisValue;
  const promiseCapability = X(yield* NewPromiseCapability(surroundingAgent.intrinsic('%Promise%')));
  if (Type(O) !== 'Object' || !('SyncIteratorRecord' in O)) {
    const invalidIteratorError = surroundingAgent.Throw('TypeError').Value;
    X(yield* Call(promiseCapability.Reject, Value.undefined, [invalidIteratorError]));
    return promiseCapability.Promise;
  }
  const syncIteratorRecord = O.SyncIteratorRecord;
  const result = yield* IteratorNext(syncIteratorRecord, value);
  IfAbruptRejectPromise(result, promiseCapability);
  return X(yield* AsyncFromSyncIteratorContinuation(result, promiseCapability));
}

// 25.1.4.2.2 #sec-%asyncfromsynciteratorprototype%.return
function* AsyncFromSyncIteratorPrototype_return([value = Value.undefined], { thisValue }) {
  const O = thisValue;
  const promiseCapability = X(yield* NewPromiseCapability(surroundingAgent.intrinsic('%Promise%')));
  if (Type(O) !== 'Object' || !('SyncIteratorRecord' in O)) {
    const invalidIteratorError = surroundingAgent.Throw('TypeError').Value;
    X(yield* Call(promiseCapability.Reject, Value.undefined, [invalidIteratorError]));
    return promiseCapability.Promise;
  }
  const syncIterator = O.SyncIteratorRecord.Iterator;
  const ret = yield* GetMethod(syncIterator, new Value('return'));
  IfAbruptRejectPromise(ret, promiseCapability);
  if (ret === Value.undefined) {
    const iterResult = X(yield* CreateIterResultObject(value, Value.true));
    X(yield* Call(promiseCapability.Resolve, Value.undefined, [iterResult]));
    return promiseCapability.Promise;
  }
  const result = yield* Call(ret, syncIterator, [value]);
  IfAbruptRejectPromise(result, promiseCapability);
  if (Type(result) !== 'Object') {
    X(yield* Call(promiseCapability.Reject, Value.undefined, [
      surroundingAgent.Throw('TypeError', 'iterator result was not an object').Value,
    ]));
    return promiseCapability.Promise;
  }
  return X(yield* AsyncFromSyncIteratorContinuation(result, promiseCapability));
}

// 25.1.4.2.3 #sec-%asyncfromsynciteratorprototype%.throw
function* AsyncFromSyncIteratorPrototype_throw([value = Value.undefined], { thisValue }) {
  const O = thisValue;
  const promiseCapability = X(yield* NewPromiseCapability(surroundingAgent.intrinsic('%Promise%')));
  if (Type(O) !== 'Object' || !('SyncIteratorRecord' in O)) {
    const invalidIteratorError = surroundingAgent.Throw('TypeError').Value;
    X(yield* Call(promiseCapability.Reject, Value.undefined, [invalidIteratorError]));
    return promiseCapability.Promise;
  }
  const syncIterator = O.SyncIteratorRecord.Iterator;
  const thr = yield* GetMethod(syncIterator, new Value('throw'));
  IfAbruptRejectPromise(thr, promiseCapability);
  if (thr === Value.undefined) {
    X(yield* Call(promiseCapability.Reject, Value.undefined, [value]));
    return promiseCapability.Promise;
  }
  const result = yield* Call(thr, syncIterator, [value]);
  IfAbruptRejectPromise(result, promiseCapability);
  if (Type(result) !== 'Object') {
    X(yield* Call(promiseCapability.Reject, Value.undefined, [
      surroundingAgent.Throw('TypeError', 'iterator result was not an object').Value,
    ]));
    return promiseCapability.Promise;
  }
  return X(yield* AsyncFromSyncIteratorContinuation(result, promiseCapability));
}

export function CreateAsyncFromSyncIteratorPrototype(realmRec) {
  const proto = BootstrapPrototype(realmRec, [
    ['next', AsyncFromSyncIteratorPrototype_next, 1],
    ['return', AsyncFromSyncIteratorPrototype_return, 1],
    ['throw', AsyncFromSyncIteratorPrototype_throw, 1],
  ], realmRec.Intrinsics['%AsyncIteratorPrototype%'], 'Async-from-Sync Iterator');

  realmRec.Intrinsics['%AsyncFromSyncIteratorPrototype%'] = proto;
}
