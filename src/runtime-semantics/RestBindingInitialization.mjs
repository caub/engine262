import {
  surroundingAgent,
} from '../engine.mjs';
import {
  CopyDataProperties,
  InitializeReferencedBinding,
  ObjectCreate,
  PutValue,
  ResolveBinding,
} from '../abstract-ops/all.mjs';
import {
  Type,
  Value,
} from '../value.mjs';
import {
  Q,
} from '../completion.mjs';

// 13.3.3.7 #sec-destructuring-binding-patterns-runtime-semantics-restbindinginitialization
//   BindingRestProperty : `...` BindingIdentifier
export function* RestBindingInitialization_BindingRestProperty(BindingRestProperty, value, environment, excludedNames) {
  const BindingIdentifier = BindingRestProperty.argument;
  const lhs = Q(yield* ResolveBinding(new Value(BindingIdentifier.name), environment, BindingIdentifier.strict));
  const restObj = ObjectCreate(surroundingAgent.intrinsic('%ObjectPrototype%'));
  Q(yield* CopyDataProperties(restObj, value, excludedNames));
  if (Type(environment) === 'Undefined') {
    return yield* PutValue(lhs, restObj);
  }
  return yield* InitializeReferencedBinding(lhs, restObj);
}
