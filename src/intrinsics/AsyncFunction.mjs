import { surroundingAgent } from '../engine.mjs';
import { Q } from '../completion.mjs';
import { BootstrapConstructor } from './Bootstrap.mjs';
import { CreateDynamicFunction } from '../runtime-semantics/all.mjs';

function* AsyncFunctionConstructor(args, { NewTarget }) {
  const C = surroundingAgent.activeFunctionObject;
  return Q(yield* CreateDynamicFunction(C, NewTarget, 'async', args));
}

export function CreateAsyncFunction(realmRec) {
  const cons = BootstrapConstructor(realmRec, AsyncFunctionConstructor, 'AsyncFunction', 1, realmRec.Intrinsics['%AsyncFunctionPrototype%'], []);
  cons.Prototype = realmRec.Intrinsics['%Function%'];
  realmRec.Intrinsics['%AsyncFunction%'] = cons;
}
