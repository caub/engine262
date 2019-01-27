import { Evaluate } from '../evaluator.mjs';
import { Q } from '../completion.mjs';
import { GetValue, ToInt32, ToUint32 } from '../abstract-ops/all.mjs';
import { Value } from '../value.mjs';
import { OutOfRange } from '../helpers.mjs';

/* eslint-disable no-bitwise */

export function* EvaluateBinopValues_ShiftExpression(operator, lval, rval) {
  switch (operator) {
    case '<<': {
      const lnum = Q(yield* ToInt32(lval));
      const rnum = Q(yield* ToUint32(rval));
      const shiftCount = rnum.numberValue() & 0x1F;
      return new Value(lnum.numberValue() << shiftCount);
    }

    case '>>': {
      const lnum = Q(yield* ToInt32(lval));
      const rnum = Q(yield* ToUint32(rval));
      const shiftCount = rnum.numberValue() & 0x1F;
      return new Value(lnum.numberValue() >> shiftCount);
    }

    case '>>>': {
      const lnum = Q(yield* ToUint32(lval));
      const rnum = Q(yield* ToUint32(rval));
      const shiftCount = rnum.numberValue() & 0x1F;
      return new Value(lnum.numberValue() >>> shiftCount);
    }

    default:
      throw new OutOfRange('EvaluateBinopValues_ShiftExpression', operator);
  }
}

// ShiftExpression :
//   ShiftExpression << AdditiveExpression
//   ShiftExpression >> AdditiveExpression
//   ShiftExpression >>> AdditiveExpression
export function* Evaluate_ShiftExpression({
  left: ShiftExpression,
  operator,
  right: AdditiveExpression,
}) {
  const lref = yield* Evaluate(ShiftExpression);
  const lval = Q(yield* GetValue(lref));
  const rref = yield* Evaluate(AdditiveExpression);
  const rval = Q(yield* GetValue(rref));
  return yield* EvaluateBinopValues_ShiftExpression(operator, lval, rval);
}
