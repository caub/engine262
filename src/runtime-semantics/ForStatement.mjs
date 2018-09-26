import { surroundingAgent } from '../engine.mjs';
import { Type, New as NewValue } from '../value.mjs';
import {
  Assert,
  CreateBuiltinFunction,
  CreateDataProperty,
  CreateIterResultObject,
  GetIterator,
  GetValue,
  InitializeReferencedBinding,
  IteratorClose,
  IteratorStep,
  IteratorValue,
  LoopContinues,
  ObjectCreate,
  PutValue,
  ResolveBinding,
  ToBoolean,
  ToObject,
} from '../abstract-ops/all.mjs';
import {
  Q, X, ReturnIfAbrupt,
  Completion,
  AbruptCompletion,
  BreakCompletion,
  NormalCompletion,
  UpdateEmpty,
} from '../completion.mjs';
import {
  isForStatementWithExpression,
  isForStatementWithVariableStatement,
  isForStatementWithLexicalDeclaration,
  isForInStatementWithExpression,
  isForInStatementWithForDeclaration,
  isForInStatementWithVarForBinding,
  isForOfStatementWithExpression,
  isForOfStatementWithForDeclaration,
  isForOfStatementWithVarForBinding,
  isForDeclaration,
  isForBinding,
} from '../ast.mjs';
import {
  BoundNames_ForBinding,
  BoundNames_ForDeclaration,
  BoundNames_LexicalDeclaration,
  IsConstantDeclaration,
  IsDestructuring_ForBinding,
  IsDestructuring_ForDeclaration,
} from '../static-semantics/all.mjs';
import {
  BindingInitialization_ForBinding,
  BindingInitialization_ForDeclaration,
  DestructuringAssignmentEvaluation_AssignmentPattern,
} from './all.mjs';
import { Evaluate_Expression, Evaluate_Statement } from '../evaluator.mjs';
import {
  DeclarativeEnvironmentRecord,
  NewDeclarativeEnvironment,
} from '../environment.mjs';
import { outOfRange } from '../helpers.mjs';

// 13.7.4.8 #sec-forbodyevaluation
function ForBodyEvaluation(test, increment, stmt, perIterationBindings, labelSet) {
  let V = NewValue(undefined);
  Q(CreatePerIterationEnvironment(perIterationBindings));
  while (true) {
    if (test) {
      const testRef = Evaluate_Expression(test);
      const testValue = Q(GetValue(testRef));
      if (ToBoolean(testValue).isFalse()) {
        return new NormalCompletion(V);
      }
    }
    const result = Evaluate_Statement(stmt);
    if (LoopContinues(result, labelSet).isFalse()) {
      return Completion(UpdateEmpty(result, V));
    }
    if (result.Value !== undefined) {
      V = result.Value;
    }
    Q(CreatePerIterationEnvironment(perIterationBindings));
    if (increment) {
      const incRef = Evaluate_Expression(increment);
      Q(GetValue(incRef));
    }
  }
}

// 13.7.4.9 #sec-createperiterationenvironment
function CreatePerIterationEnvironment(perIterationBindings) {
  if (perIterationBindings.length > 0) {
    const lastIterationEnv = surroundingAgent.runningExecutionContext.LexicalEnvironment;
    const lastIterationEnvRec = lastIterationEnv.EnvironmentRecord;
    const outer = lastIterationEnv.outerEnvironmentReference;
    Assert(Type(outer) !== 'Null');
    const thisIterationEnv = NewDeclarativeEnvironment(outer);
    const thisIterationEnvRec = thisIterationEnv.EnvironmentRecord;
    for (const bn of perIterationBindings) {
      X(thisIterationEnvRec.CreateMutableBinding(bn, false));
      const lastValue = Q(lastIterationEnvRec.GetBindingValue(bn, NewValue(true)));
      thisIterationEnvRec.InitializeBinding(bn, lastValue);
    }
    surroundingAgent.runningExecutionContext.LexicalEnvironment = thisIterationEnv;
  }
  return NewValue(undefined);
}

// 13.7.5.10 #sec-runtime-semantics-bindinginstantiation
function BindingInstantiation_ForDeclaration(ForDeclaration, environment) {
  const envRec = environment.EnvironmentRecord;
  Assert(envRec instanceof DeclarativeEnvironmentRecord);
  const ForBinding = ForDeclaration.declarations[0].id;
  for (const name of BoundNames_ForBinding(ForBinding)) {
    if (IsConstantDeclaration(ForDeclaration)) {
      X(envRec.CreateImmutableBinding(name, NewValue(true)));
    } else {
      X(envRec.CreateMutableBinding(name, false));
    }
  }
}

// 13.7.5.12 #sec-runtime-semantics-forin-div-ofheadevaluation-tdznames-expr-iterationkind
function ForInOfHeadEvaluation(TDZnames, expr, iterationKind) {
  const oldEnv = surroundingAgent.runningExecutionContext.LexicalEnvironment;
  if (TDZnames.length > 0) {
    Assert(new Set(TDZnames).size === TDZnames.length);
    const TDZ = NewDeclarativeEnvironment(oldEnv);
    const TDZEnvRec = TDZ.EnvironmentRecord;
    for (const name of TDZnames) {
      X(TDZEnvRec.CreateMutableBinding(name, false));
    }
    surroundingAgent.runningExecutionContext.LexicalEnvironment = TDZ;
  }
  const exprRef = Evaluate_Expression(expr);
  surroundingAgent.runningExecutionContext.LexicalEnvironment = oldEnv;
  const exprValue = Q(GetValue(exprRef));
  if (iterationKind === 'enumerate') {
    if (Type(exprValue) === 'Undefined' || Type(exprValue) === 'Null') {
      return new BreakCompletion(undefined);
    }
    const obj = X(ToObject(exprValue));
    return Q(EnumerateObjectProperties(obj));
  } else {
    Assert(iterationKind === 'iterate' || iterationKind === 'async-iterate');
    const iteratorHint = iterationKind === 'async-iterate' ? 'async' : 'hint';
    return Q(GetIterator(exprValue, iteratorHint));
  }
}

// 13.7.5.13 #sec-runtime-semantics-forin-div-ofbodyevaluation-lhs-stmt-iterator-lhskind-labelset
function ForInOfBodyEvaluation(lhs, stmt, iteratorRecord, iterationKind, lhsKind, labelSet/* , iteratorKind = 'sync' */) {
  const oldEnv = surroundingAgent.runningExecutionContext.LexicalEnvironment;
  let V = NewValue(undefined);
  const destructuring = lhs.type === 'VariableDeclaration'
    ? IsDestructuring_ForDeclaration(lhs) : IsDestructuring_ForBinding(lhs);
  let assignmentPattern;
  if (destructuring && lhsKind === 'assignment') {
    assignmentPattern = lhs;
  }
  while (true) {
    // TODO: this section of the spec is completely wrong. See https://github.com/tc39/ecma262/issues/1107.
    // const nextResult = Q(Call(iteratorRecord.NextMethod, iteratorRecord.Iterator, []));
    // if (iteratorKind === 'async')
    // if (Type(nextResult) !== 'Object') {
    //   return surroundingAgent.Throw('TypeError');
    // }

    // NON-SPEC START
    const nextResult = Q(IteratorStep(iteratorRecord));
    if (nextResult === NewValue(false)) {
      return new NormalCompletion(V);
    }
    // NON-SPEC END

    const nextValue = Q(IteratorValue(nextResult));
    let iterationEnv;
    let lhsRef;
    if (lhsKind === 'assignment' || lhsKind === 'varBinding') {
      if (!destructuring) {
        lhsRef = Evaluate_Expression(lhs);
      }
    } else {
      Assert(lhsKind === 'lexicalBinding');
      Assert(isForDeclaration(lhs));
      iterationEnv = NewDeclarativeEnvironment(oldEnv);
      BindingInstantiation_ForDeclaration(lhs, iterationEnv);
      surroundingAgent.runningExecutionContext.LexicalEnvironment = iterationEnv;
      if (!destructuring) {
        const lhsNames = BoundNames_ForDeclaration(lhs);
        Assert(lhsNames.length === 1);
        const [lhsName] = lhsNames;
        lhsRef = X(ResolveBinding(lhsName));
      }
    }
    let status;
    if (!destructuring) {
      if (lhsRef instanceof AbruptCompletion) {
        status = lhsRef;
      } else if (lhsKind === 'lexicalBinding') {
        status = InitializeReferencedBinding(lhsRef, nextValue);
      } else {
        status = PutValue(lhsRef, nextValue);
      }
    } else {
      if (lhsKind === 'assignment') {
        status = DestructuringAssignmentEvaluation_AssignmentPattern(assignmentPattern, nextValue);
      } else if (lhsKind === 'varBinding') {
        Assert(isForBinding(lhs));
        status = BindingInitialization_ForBinding(lhs, nextValue, NewValue(undefined));
      } else {
        Assert(lhsKind === 'lexicalBinding');
        Assert(isForDeclaration(lhs));
        status = BindingInitialization_ForDeclaration(lhs, nextValue, iterationEnv);
      }
    }
    if (status instanceof AbruptCompletion) {
      surroundingAgent.runningExecutionContext.LexicalEnvironment = oldEnv;
      // TODO(asynciteration)
      // if (iteratorKind === 'async') {
      //   return Q(AsyncIteratorClose(iteratorRecord, status));
      // }
      if (iterationKind === 'enumerate') {
        return status;
      } else {
        Assert(iterationKind === 'iterate');
        return Q(IteratorClose(iteratorRecord, status));
      }
    }
    const result = Evaluate_Statement(stmt);
    surroundingAgent.runningExecutionContext.LexicalEnvironment = oldEnv;
    if (LoopContinues(result, labelSet).isFalse()) {
      if (iterationKind === 'enumerate') {
        return Completion(UpdateEmpty(result, V));
      } else {
        Assert(iterationKind === 'iterate');
        status = UpdateEmpty(result, V);
        // TODO(asynciteration)
        // if (iteratorKind === 'async') {
        //   return Q(AsyncIteratorClose(iteratorRecord, status));
        // }
        return Q(IteratorClose(iteratorRecord, status));
      }
    }
    if (result.Value !== undefined) {
      V = result.Value;
    }
  }
}

// #sec-do-while-statement-runtime-semantics-labelledevaluation
//   IterationStatement : `do` Statement `while` `(` Expression `)` `;`
//
// #sec-while-statement-runtime-semantics-labelledevaluation
//   IterationStatement : `while` `(` Expression `)` Statement
//
// #sec-for-statement-runtime-semantics-labelledevaluation
//   IterationStatement :
//     `for` `(` Expression `;` Expression `;` Expression `)` Statement
//     `for` `(` `var` VariableDeclarationList `;` Expression `;` Expression `)` Statement
//     `for` `(` LexicalDeclarationExpression `;` Expression `)` Statement
//
// 13.7.5.11 #sec-for-in-and-for-of-statements-runtime-semantics-labelledevaluation
//   IterationStatement :
//     `for` `(` LeftHandSideExpression `in` Expression `)` Statement
//     `for` `(` `var` ForBinding `in` Expression `)` Statement
//     `for` `(` ForDeclaration `in` Expression `)` Statement
//     `for` `(` LeftHandSideExpression `of` AssignmentExpression `)` Statement
//     `for` `(` `var` ForBinding `of` AssignmentExpression `)` Statement
//     `for` `(` ForDeclaration `of` AssignmentExpression `)` Statement
//     `for` `await` `(` LeftHandSideExpression `of` AssignmentExpression `)` Statement
//     `for` `await` `(` `var` ForBinding `of` AssignmentExpression `)` Statement
//     `for` `await` `(` ForDeclaration `of` AssignmentExpression `)` Statement
export function LabelledEvaluation_IterationStatement(IterationStatement, labelSet) {
  switch (true) {
    // case isDoWhileStatement(IterationStatement):

    // case isWhileStatement(IterationStatement):

    case isForStatementWithExpression(IterationStatement):
      if (IterationStatement.init) {
        const exprRef = Evaluate_Expression(IterationStatement.init);
        Q(GetValue(exprRef));
      }
      return Q(ForBodyEvaluation(IterationStatement.test, IterationStatement.update, IterationStatement.body, [], labelSet));

    case isForStatementWithVariableStatement(IterationStatement): {
      let varDcl = Evaluate_Statement(IterationStatement.init);
      ReturnIfAbrupt(varDcl);
      return Q(ForBodyEvaluation(IterationStatement.test, IterationStatement.update, IterationStatement.body, [], labelSet));
    }

    case isForStatementWithLexicalDeclaration(IterationStatement): {
      const oldEnv = surroundingAgent.runningExecutionContext.LexicalEnvironment;
      const loopEnv = NewDeclarativeEnvironment(oldEnv);
      const loopEnvRec = loopEnv.EnvironmentRecord;
      const isConst = IsConstantDeclaration(IterationStatement.init);
      const boundNames = BoundNames_LexicalDeclaration(IterationStatement.init).map(NewValue);
      for (const dn of boundNames) {
        if (isConst) {
          X(loopEnvRec.CreateImmutableBinding(dn, NewValue(true)));
        } else {
          X(loopEnvRec.CreateMutableBinding(dn, true));
        }
      }
      surroundingAgent.runningExecutionContext.LexicalEnvironment = loopEnv;
      const forDcl = Evaluate_Statement(IterationStatement.init);
      if (forDcl instanceof AbruptCompletion) {
        surroundingAgent.runningExecutionContext.LexicalEnvironment = oldEnv;
        return Completion(forDcl);
      }
      const perIterationLets = isConst ? [] : boundNames;
      const bodyResult = ForBodyEvaluation(IterationStatement.test, IterationStatement.update, IterationStatement.body, perIterationLets, labelSet);
      surroundingAgent.runningExecutionContext.LexicalEnvironment = oldEnv;
      return Completion(bodyResult);
    }

    case isForInStatementWithExpression(IterationStatement): {
      const {
        left: LeftHandSideExpression,
        right: Expression,
        body: Statement,
      } = IterationStatement;
      const keyResult = Q(ForInOfHeadEvaluation([], Expression, 'enumerate'));
      return Q(ForInOfBodyEvaluation(LeftHandSideExpression, Statement, keyResult, 'enumerate', 'assignment', labelSet));
    }

    case isForInStatementWithVarForBinding(IterationStatement): {
      const {
        left: {
          declarations: [{ id: ForBinding }],
        },
        right: Expression,
        body: Statement,
      } = IterationStatement;
      const keyResult = Q(ForInOfHeadEvaluation([], Expression, 'enumerate'));
      return Q(ForInOfBodyEvaluation(ForBinding, Statement, keyResult, 'enumerate', 'varBinding', labelSet));
    }

    case isForInStatementWithForDeclaration(IterationStatement): {
      const {
        left: ForDeclaration,
        right: Expression,
        body: Statement,
      } = IterationStatement;
      const keyResult = Q(ForInOfHeadEvaluation(BoundNames_ForDeclaration(ForDeclaration), Expression, 'enumerate'));
      return Q(ForInOfBodyEvaluation(ForDeclaration, Statement, keyResult, 'enumerate', 'lexicalBinding', labelSet));
    }

    case isForOfStatementWithExpression(IterationStatement): {
      const {
        left: LeftHandSideExpression,
        right: AssignmentExpression,
        body: Statement,
      } = IterationStatement;
      const keyResult = Q(ForInOfHeadEvaluation([], AssignmentExpression, 'iterate'));
      return Q(ForInOfBodyEvaluation(LeftHandSideExpression, Statement, keyResult, 'iterate', 'assignment', labelSet));
    }

    case isForOfStatementWithVarForBinding(IterationStatement): {
      const {
        left: {
          declarations: [{ id: ForBinding }],
        },
        right: AssignmentExpression,
        body: Statement,
      } = IterationStatement;
      const keyResult = Q(ForInOfHeadEvaluation([], AssignmentExpression, 'iterate'));
      return Q(ForInOfBodyEvaluation(ForBinding, Statement, keyResult, 'iterate', 'varBinding', labelSet));
    }

    case isForOfStatementWithForDeclaration(IterationStatement): {
      const {
        left: ForDeclaration,
        right: AssignmentExpression,
        body: Statement,
      } = IterationStatement;
      const keyResult = Q(ForInOfHeadEvaluation(BoundNames_ForDeclaration(ForDeclaration), AssignmentExpression, 'iterate'));
      return Q(ForInOfBodyEvaluation(ForDeclaration, Statement, keyResult, 'iterate', 'lexicalBinding', labelSet));
    }

    default:
      throw outOfRange('LabelledEvaluation_IterationStatement', IterationStatement);
  }
}

function* InternalEnumerateObjectProperties(O) {
  const visited = new Set();
  const keys = Q(O.OwnPropertyKeys());
  for (const key of keys) {
    if (Type(key) === 'Symbol') {
      continue;
    }
    const desc = Q(O.GetOwnProperty(key));
    if (Type(desc) !== 'Undefined') {
      visited.add(key);
      if (desc.Enumerable) {
        yield key;
      }
    }
  }
  const proto = Q(O.GetPrototypeOf());
  if (Type(proto) === 'Null') {
    return;
  }
  for (const protoKey of InternalEnumerateObjectProperties(proto)) {
    if (!visited.has(protoKey)) {
      yield protoKey;
    }
  }
}

// 13.7.5.15 #sec-enumerate-object-properties
function EnumerateObjectProperties(O) {
  Assert(Type(O) === 'Object');
  const internalIterator = InternalEnumerateObjectProperties(O);
  const iterator = X(ObjectCreate(NewValue(null)));
  const nextMethod = CreateBuiltinFunction(() => {
    let { value, done } = internalIterator.next();
    if (value === undefined) {
      value = NewValue(value);
    }
    done = NewValue(done);
    return X(CreateIterResultObject(value, done));
  }, []);
  X(CreateDataProperty(iterator, NewValue('next'), nextMethod));
  X(CreateDataProperty(iterator, NewValue('throw'), NewValue(null)));
  X(CreateDataProperty(iterator, NewValue('return'), NewValue(null)));
  return {
    Iterator: iterator,
    NextMethod: nextMethod,
    Done: NewValue(false),
  };
}