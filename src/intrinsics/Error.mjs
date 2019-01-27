import {
  DefinePropertyOrThrow,
  OrdinaryCreateFromConstructor,
  ToString,
} from '../abstract-ops/all.mjs';
import {
  Descriptor,
  Type,
  Value,
} from '../value.mjs';
import { Q, X } from '../completion.mjs';
import { surroundingAgent } from '../engine.mjs';
import { BootstrapConstructor } from './Bootstrap.mjs';
import { captureStack } from '../helpers.mjs';

function* ErrorConstructor([message = Value.undefined], { NewTarget }) {
  let newTarget;
  if (Type(NewTarget) === 'Undefined') {
    newTarget = surroundingAgent.activeFunctionObject;
  } else {
    newTarget = NewTarget;
  }
  const O = Q(yield* OrdinaryCreateFromConstructor(newTarget, '%ErrorPrototype%', ['ErrorData']));
  if (Type(message) !== 'Undefined') {
    const msg = Q(yield* ToString(message));
    const msgDesc = Descriptor({
      Value: msg,
      Writable: Value.true,
      Enumerable: Value.false,
      Configurable: Value.true,
    });
    X(yield* DefinePropertyOrThrow(O, new Value('message'), msgDesc));
  }

  X(captureStack(O)); // non-spec

  return O;
}

export function CreateError(realmRec) {
  const error = BootstrapConstructor(realmRec, ErrorConstructor, 'Error', 1, realmRec.Intrinsics['%ErrorPrototype%'], []);

  realmRec.Intrinsics['%Error%'] = error;
}
