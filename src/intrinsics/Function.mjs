import { surroundingAgent } from '../engine.mjs';
import { Q } from '../completion.mjs';
import { BootstrapConstructor } from './Bootstrap.mjs';
import { CreateDynamicFunction } from '../runtime-semantics/all.mjs';

function* FunctionConstructor(args, { NewTarget }) {
  const C = surroundingAgent.activeFunctionObject;
  return Q(yield* CreateDynamicFunction(C, NewTarget, 'normal', args));
}

export function CreateFunction(realmRec) {
  const cons = BootstrapConstructor(realmRec, FunctionConstructor, 'Function', 1, realmRec.Intrinsics['%FunctionPrototype%'], []);
  realmRec.Intrinsics['%Function%'] = cons;
}
