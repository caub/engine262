import {
  GetValue,
  HasOwnProperty,
  PutValue,
  ResolveBinding,
  SetFunctionName,
} from '../abstract-ops/all.mjs';
import { BindingInitialization_BindingPattern } from './all.mjs';
import {
  isBindingIdentifier,
  isBindingPattern,
} from '../ast.mjs';
import {
  NormalCompletion, Q, ReturnIfAbrupt, X,
} from '../completion.mjs';
import { Evaluate } from '../evaluator.mjs';
import { OutOfRange } from '../helpers.mjs';
import { IsAnonymousFunctionDefinition } from '../static-semantics/all.mjs';
import { Value } from '../value.mjs';

// 13.3.2.4 #sec-variable-statement-runtime-semantics-evaluation
//   VariableDeclaration :
//     BindingIdentifier
//     BindingIdentifier Initializer
//     BindingPattern Initializer
export function* Evaluate_VariableDeclaration(VariableDeclaration) {
  switch (true) {
    case isBindingIdentifier(VariableDeclaration.id) && VariableDeclaration.init === null:
      return new NormalCompletion(undefined);

    case isBindingIdentifier(VariableDeclaration.id) && VariableDeclaration.init !== null: {
      const {
        id: BindingIdentifier,
        init: Initializer,
      } = VariableDeclaration;
      const bindingId = new Value(BindingIdentifier.name);
      const lhs = Q(yield* ResolveBinding(bindingId, undefined, BindingIdentifier.strict));
      const rhs = yield* Evaluate(Initializer);
      const value = Q(yield* GetValue(rhs));
      if (IsAnonymousFunctionDefinition(Initializer)) {
        const hasNameProperty = Q(yield* HasOwnProperty(value, new Value('name')));
        if (hasNameProperty === Value.false) {
          X(yield* SetFunctionName(value, bindingId));
        }
      }
      return Q(yield* PutValue(lhs, value));
    }

    case isBindingPattern(VariableDeclaration.id) && VariableDeclaration.init !== null: {
      const {
        id: BindingPattern,
        init: Initializer,
      } = VariableDeclaration;
      const rhs = yield* Evaluate(Initializer);
      const rval = Q(yield* GetValue(rhs));
      return yield* BindingInitialization_BindingPattern(BindingPattern, rval, Value.undefined);
    }

    default:
      throw new OutOfRange('Evaluate_VariableDeclaration', VariableDeclaration);
  }
}

// 13.3.2.4 #sec-variable-statement-runtime-semantics-evaluation
//   VariableDeclarationList : VariableDeclarationList `,` VariableDeclaration
//
// (implicit)
//   VariableDeclarationList : VariableDeclaration
export function* Evaluate_VariableDeclarationList(VariableDeclarationList) {
  let next;
  for (const VariableDeclaration of VariableDeclarationList) {
    next = yield* Evaluate_VariableDeclaration(VariableDeclaration);
    ReturnIfAbrupt(next);
  }
  return next;
}

// 13.3.2.4 #sec-variable-statement-runtime-semantics-evaluation
//   VariableStatement : `var` VariableDeclarationList `;`
export function* Evaluate_VariableStatement(VariableStatement) {
  const next = yield* Evaluate_VariableDeclarationList(VariableStatement.declarations);
  ReturnIfAbrupt(next);
  return new NormalCompletion(undefined);
}
