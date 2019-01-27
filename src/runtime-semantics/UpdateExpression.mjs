import { Evaluate } from '../evaluator.mjs';
import { OutOfRange } from '../helpers.mjs';
import {
  GetValue,
  PutValue,
  ToNumber,
} from '../abstract-ops/all.mjs';
import {
  EvaluateBinopValues_AdditiveExpression_Minus,
  EvaluateBinopValues_AdditiveExpression_Plus,
} from './all.mjs';
import { Value } from '../value.mjs';
import { Q } from '../completion.mjs';

export function* Evaluate_UpdateExpression({
  operator,
  prefix,
  argument,
}) {
  switch (true) {
    // UpdateExpression : LeftHandSideExpression `++`
    case operator === '++' && !prefix: {
      const LeftHandSideExpression = argument;

      const lhs = yield* Evaluate(LeftHandSideExpression);
      const lhsValue = Q(yield* GetValue(lhs));
      const oldValue = Q(yield* ToNumber(lhsValue));
      const newValue = yield* EvaluateBinopValues_AdditiveExpression_Plus(oldValue, new Value(1));
      Q(yield* PutValue(lhs, newValue));
      return oldValue;
    }

    // UpdateExpression : LeftHandSideExpression `--`
    case operator === '--' && !prefix: {
      const LeftHandSideExpression = argument;

      const lhs = yield* Evaluate(LeftHandSideExpression);
      const lhsVal = Q(yield* GetValue(lhs));
      const oldValue = Q(yield* ToNumber(lhsVal));
      const newValue = yield* EvaluateBinopValues_AdditiveExpression_Minus(oldValue, new Value(1));
      Q(yield* PutValue(lhs, newValue));
      return oldValue;
    }

    // UpdateExpression : `++` UnaryExpression
    case operator === '++' && prefix: {
      const UnaryExpression = argument;

      const expr = yield* Evaluate(UnaryExpression);
      const exprVal = Q(yield* GetValue(expr));
      const oldValue = Q(yield* ToNumber(exprVal));
      const newValue = yield* EvaluateBinopValues_AdditiveExpression_Plus(oldValue, new Value(1));
      Q(yield* PutValue(expr, newValue));
      return newValue;
    }

    // UpdateExpression : `--` UnaryExpression
    case operator === '--' && prefix: {
      const UnaryExpression = argument;

      const expr = yield* Evaluate(UnaryExpression);
      const exprVal = Q(yield* GetValue(expr));
      const oldValue = Q(yield* ToNumber(exprVal));
      const newValue = yield* EvaluateBinopValues_AdditiveExpression_Minus(oldValue, new Value(1));
      Q(yield* PutValue(expr, newValue));
      return newValue;
    }

    default:
      throw new OutOfRange('Evaluate_UpdateExpression', operator, prefix);
  }
}
