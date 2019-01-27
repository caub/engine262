import { Value } from '../value.mjs';
import { Q } from '../completion.mjs';
import { GetValue, ToNumber } from '../abstract-ops/all.mjs';
import { Evaluate } from '../evaluator.mjs';

export function* EvaluateBinopValues_ExponentiationExpression(lval, rval) {
  const base = Q(yield* ToNumber(lval));
  const exponent = Q(yield* ToNumber(rval));
  return new Value(base.numberValue() ** exponent.numberValue());
}

// 12.6.3 #sec-exp-operator-runtime-semantics-evaluation
// ExponentiationExpression : UpdateExpression ** ExponentiationExpression
export function* Evaluate_ExponentiationExpression({
  left: UpdateExpression,
  right: ExponentiationExpression,
}) {
  const left = yield* Evaluate(UpdateExpression);
  const leftValue = Q(yield* GetValue(left));
  const right = yield* Evaluate(ExponentiationExpression);
  const rightValue = Q(yield* GetValue(right));
  return EvaluateBinopValues_ExponentiationExpression(leftValue, rightValue);
}
