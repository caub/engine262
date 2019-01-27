import { surroundingAgent } from '../engine.mjs';
import { Q } from '../completion.mjs';
import { BootstrapConstructor } from './Bootstrap.mjs';
import { CreateDynamicFunction } from '../runtime-semantics/all.mjs';

function GeneratorFunctionConstructor(args, { NewTarget }) {
  const C = surroundingAgent.activeFunctionObject;
  return Q(CreateDynamicFunction(C, NewTarget, 'generator', args));
}

export function CreateGeneratorFunction(realmRec) {
  const generator = realmRec.Intrinsics['%Generator%'];
  const cons = BootstrapConstructor(realmRec, GeneratorFunctionConstructor, 'GeneratorFunction', 1, generator, []);
  realmRec.Intrinsics['%GeneratorFunction%'] = cons;
}
