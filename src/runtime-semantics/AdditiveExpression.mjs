import {
  isAdditiveExpressionWithMinus,
  isAdditiveExpressionWithPlus,
} from '../ast.mjs';
import {
  GetValue,
  ToNumber,
  ToPrimitive,
  ToString,
} from '../abstract-ops/all.mjs';
import { Evaluate } from '../evaluator.mjs';
import { Q } from '../completion.mjs';
import {
  Type,
  Value,
} from '../value.mjs';
import { OutOfRange } from '../helpers.mjs';

export function* EvaluateBinopValues_AdditiveExpression_Plus(lval, rval) {
  const lprim = Q(yield* ToPrimitive(lval));
  const rprim = Q(yield* ToPrimitive(rval));
  if (Type(lprim) === 'String' || Type(rprim) === 'String') {
    const lstr = Q(yield* ToString(lprim));
    const rstr = Q(yield* ToString(rprim));
    return new Value(lstr.stringValue() + rstr.stringValue());
  }
  const lnum = Q(yield* ToNumber(lprim));
  const rnum = Q(yield* ToNumber(rprim));
  return new Value(lnum.numberValue() + rnum.numberValue());
}

// 12.8.3.1 #sec-addition-operator-plus-runtime-semantics-evaluation
//  AdditiveExpression : AdditiveExpression + MultiplicativeExpression
function* Evaluate_AdditiveExpression_Plus(AdditiveExpression, MultiplicativeExpression) {
  const lref = yield* Evaluate(AdditiveExpression);
  const lval = Q(yield* GetValue(lref));
  const rref = yield* Evaluate(MultiplicativeExpression);
  const rval = Q(yield* GetValue(rref));
  return yield* EvaluateBinopValues_AdditiveExpression_Plus(lval, rval);
}

export function* EvaluateBinopValues_AdditiveExpression_Minus(lval, rval) {
  const lnum = Q(yield* ToNumber(lval));
  const rnum = Q(yield* ToNumber(rval));
  return new Value(lnum.numberValue() - rnum.numberValue());
}

// 12.8.4.1 #sec-subtraction-operator-minus-runtime-semantics-evaluation
function* Evaluate_AdditiveExpression_Minus(
  AdditiveExpression, MultiplicativeExpression,
) {
  const lref = yield* Evaluate(AdditiveExpression);
  const lval = Q(yield* GetValue(lref));
  const rref = yield* Evaluate(MultiplicativeExpression);
  const rval = Q(yield* GetValue(rref));
  return yield* EvaluateBinopValues_AdditiveExpression_Minus(lval, rval);
}

export function* Evaluate_AdditiveExpression(AdditiveExpression) {
  switch (true) {
    case isAdditiveExpressionWithPlus(AdditiveExpression):
      return yield* Evaluate_AdditiveExpression_Plus(
        AdditiveExpression.left, AdditiveExpression.right,
      );
    case isAdditiveExpressionWithMinus(AdditiveExpression):
      return yield* Evaluate_AdditiveExpression_Minus(
        AdditiveExpression.left, AdditiveExpression.right,
      );

    default:
      throw new OutOfRange('Evaluate_AdditiveExpression', AdditiveExpression);
  }
}
