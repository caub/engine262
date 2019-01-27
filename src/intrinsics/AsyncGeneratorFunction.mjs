import { surroundingAgent } from '../engine.mjs';
import { Q } from '../completion.mjs';
import { BootstrapConstructor } from './Bootstrap.mjs';
import { CreateDynamicFunction } from '../runtime-semantics/all.mjs';
import { Value } from '../value.mjs';

function* AsyncGeneratorFunctionConstructor(args, { NewTarget }) {
  const C = surroundingAgent.activeFunctionObject;
  return Q(yield* CreateDynamicFunction(C, NewTarget, 'async generator', args));
}

export function CreateAsyncGeneratorFunction(realmRec) {
  const cons = BootstrapConstructor(realmRec, AsyncGeneratorFunctionConstructor, 'AsyncGeneratorFunction', 1, realmRec.Intrinsics['%AsyncGenerator%'], []);
  cons.Prototype = realmRec.Intrinsics['%Function%'];

  {
    const c = realmRec.Intrinsics['%AsyncGenerator%'].properties.get(new Value('constructor'));
    c.Writable = Value.false;
    c.Enumerable = Value.false;
    c.Configurable = Value.true;
  }

  realmRec.Intrinsics['%AsyncGeneratorFunction%'] = cons;
}
