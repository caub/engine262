import {
  GetValue,
  ToNumber,
} from '../abstract-ops/all.mjs';
import { Evaluate } from '../evaluator.mjs';
import { Q } from '../completion.mjs';
import {
  Value,
} from '../value.mjs';
import { OutOfRange } from '../helpers.mjs';

export function* EvaluateBinopValues_MultiplicativeExpression(MultiplicativeOperator, lval, rval) {
  const lnum = Q(yield* ToNumber(lval));
  const rnum = Q(yield* ToNumber(rval));

  // Return the result of applying the MultiplicativeOperator (*, /, or %)
  // to lnum and rnum as specified in 12.7.3.1, 12.7.3.2, or 12.7.3.3.
  switch (MultiplicativeOperator) {
    case '*':
      return new Value(lnum.numberValue() * rnum.numberValue());
    case '/':
      return new Value(lnum.numberValue() / rnum.numberValue());
    case '%':
      return new Value(lnum.numberValue() % rnum.numberValue());

    default:
      throw new OutOfRange('EvaluateBinopValues_MultiplicativeExpression', MultiplicativeOperator);
  }
}

export function* Evaluate_MultiplicativeExpression({
  left: MultiplicativeExpression,
  operator: MultiplicativeOperator,
  right: ExponentiationExpression,
}) {
  const left = yield* Evaluate(MultiplicativeExpression);
  const leftValue = Q(yield* GetValue(left));
  const right = yield* Evaluate(ExponentiationExpression);
  const rightValue = Q(yield* GetValue(right));
  return yield* EvaluateBinopValues_MultiplicativeExpression(
    MultiplicativeOperator, leftValue, rightValue,
  );
}
