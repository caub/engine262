import { Evaluate } from '../evaluator.mjs';
import {
  Assert,
  GetThisEnvironment,
  GetValue,
  RequireObjectCoercible,
  ToPropertyKey,
} from '../abstract-ops/all.mjs';
import { SuperReference, Value } from '../value.mjs';
import { Q } from '../completion.mjs';

// 12.3.5.3 #sec-makesuperpropertyreference
function* MakeSuperPropertyReference(actualThis, propertyKey, strict) {
  const env = yield* GetThisEnvironment();
  Assert(env.HasSuperBinding() === Value.true);
  const baseValue = Q(env.GetSuperBase());
  const bv = Q(RequireObjectCoercible(baseValue));
  return new SuperReference({
    BaseValue: bv,
    ReferencedName: propertyKey,
    thisValue: actualThis,
    StrictReference: strict ? Value.true : Value.false,
  });
}

// 12.3.5.1 #sec-super-keyword-runtime-semantics-evaluation
// SuperProperty :
//   `super` `[` Expression `]`
//   `super` `.` IdentifierName
export function* Evaluate_SuperProperty(SuperProperty) {
  if (SuperProperty.computed) {
    const Expression = SuperProperty.property;

    const env = yield* GetThisEnvironment();
    const actualThis = Q(env.GetThisBinding());
    const propertyNameReference = yield* Evaluate(Expression);
    const propertyNameValue = Q(yield* GetValue(propertyNameReference));
    const propertyKey = Q(yield* ToPropertyKey(propertyNameValue));
    const strict = SuperProperty.strict;
    return Q(MakeSuperPropertyReference(actualThis, propertyKey, strict));
  } else {
    const IdentifierName = SuperProperty.property;

    const env = yield* GetThisEnvironment();
    const actualThis = Q(env.GetThisBinding());
    const propertyKey = new Value(IdentifierName.name);
    const strict = SuperProperty.strict;
    return Q(MakeSuperPropertyReference(actualThis, propertyKey, strict));
  }
}
