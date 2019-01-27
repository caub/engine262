import { surroundingAgent } from '../engine.mjs';
import {
  isFunctionExpressionWithBindingIdentifier,
} from '../ast.mjs';
import {
  FunctionCreate,
  MakeConstructor,
  SetFunctionName,
  isStrictModeCode,
  sourceTextMatchedBy,
} from '../abstract-ops/all.mjs';
import { NewDeclarativeEnvironment } from '../environment.mjs';
import { Value } from '../value.mjs';

function* Evaluate_FunctionExpression_BindingIdentifier(FunctionExpression) {
  const {
    id: BindingIdentifier,
    params: FormalParameters,
  } = FunctionExpression;
  // If the function code for FunctionExpression is strict mode
  // code, let strict be true. Otherwise let strict be false.
  const strict = isStrictModeCode(FunctionExpression);
  const scope = surroundingAgent.runningExecutionContext.LexicalEnvironment;
  const funcEnv = NewDeclarativeEnvironment(scope);
  const envRec = funcEnv.EnvironmentRecord;
  const name = new Value(BindingIdentifier.name);
  yield* envRec.CreateImmutableBinding(name, Value.false);
  const closure = yield* FunctionCreate('Normal', FormalParameters, FunctionExpression, funcEnv, strict);
  yield* MakeConstructor(closure);
  yield* SetFunctionName(closure, name);
  closure.SourceText = sourceTextMatchedBy(FunctionExpression);
  yield* envRec.InitializeBinding(name, closure);
  return closure;
}

export function* Evaluate_FunctionExpression(FunctionExpression) {
  if (isFunctionExpressionWithBindingIdentifier(FunctionExpression)) {
    return yield* Evaluate_FunctionExpression_BindingIdentifier(FunctionExpression);
  }

  const FormalParameters = FunctionExpression.params;

  // If the function code for FunctionExpression is strict mode
  // code, let strict be true. Otherwise let strict be false.
  const strict = isStrictModeCode(FunctionExpression);
  const scope = surroundingAgent.runningExecutionContext.LexicalEnvironment;
  const closure = yield* FunctionCreate('Normal', FormalParameters, FunctionExpression, scope, strict);
  yield* MakeConstructor(closure);
  closure.SourceText = sourceTextMatchedBy(FunctionExpression);
  return closure;
}
