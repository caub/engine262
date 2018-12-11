import { surroundingAgent } from './engine.mjs';
import { AbstractModuleRecord } from './modules.mjs';
import { Value, Descriptor, BuiltinFunctionValue } from './value.mjs';
import { ToString, DefinePropertyOrThrow } from './abstract-ops/all.mjs';
import { X, AwaitFulfilledFunctions } from './completion.mjs';
import { inspect } from './api.mjs';

export class OutOfRange extends RangeError {
  constructor(fn, detail) {
    super(`${fn}() argument out of range`);

    this.detail = detail;
  }
}

export class CallSite {
  constructor(context) {
    this.context = context;
    this.isToplevel = false;
    this.isConstructor = false;
    this.lineNumber = null;
    this.columnNumber = null;
    this.methodName = null;
    this.evalOrigin = null;
  }

  isEval() {
    return !!this.evalOrigin;
  }

  isNative() {
    return this.context.Function instanceof BuiltinFunctionValue;
  }

  isAsync() {
    if (this.context.Function !== Value.null) {
      return this.context.Function.ECMAScriptCode && this.context.Function.ECMAScriptCode.async;
    }
    return false;
  }

  getThisValue() {
    if (this.context.LexicalEnvironment.HasThisBinding() === Value.true) {
      return this.context.LexicalEnvironment.GetThisBinding();
    }
    return null;
  }

  getFunctionName() {
    if (this.context.Function !== Value.null) {
      const name = this.context.Function.properties.get(new Value('name'));
      if (name) {
        return X(ToString(name.Value)).stringValue();
      }
    }
    return null;
  }

  getSpecifier() {
    if (this.context.ScriptOrModule instanceof AbstractModuleRecord) {
      return this.context.ScriptOrModule.HostDefined.specifier;
    }
    return null;
  }

  getMethodName() {
    const idx = surroundingAgent.executionContextStack.indexOf(this.context);
    const parent = surroundingAgent.executionContextStack[idx - 1];
    if (parent) {
      return parent.callSite.methodName;
    }
    return null;
  }

  setLocation(node) {
    const { line, column } = node.loc.start;
    this.lineNumber = line;
    this.columnNumber = column;
    if (node.type === 'CallExpression' || node.type === 'NewExpression') {
      if (node.callee.type === 'MemberExpression' || node.callee.type === 'Identifier') {
        this.methodName = node.callee.sourceText();
      }
    }
  }

  copy(context = this.context) {
    const c = new CallSite(context);
    c.isToplevel = this.isToplevel;
    c.isConstructor = this.isConstructor;
    c.lineNumber = this.lineNumber;
    c.columnNumber = this.columnNumber;
    c.methodName = this.methodName;
    c.evalOrigin = this.evalOrigin;
    return c;
  }

  static loc(site) {
    if (site.isNative()) {
      return 'native';
    }
    let out = '';
    const specifier = site.getSpecifier();
    if (!specifier && site.isEval()) {
      out += this.formatEvalOrigin(site, site.evalOrigin);
    }
    if (specifier) {
      out += specifier;
    } else {
      out += '<anonymous>';
    }
    if (site.lineNumber !== null) {
      out += `:${site.lineNumber}`;
      if (site.columnNumber !== null) {
        out += `:${site.columnNumber}`;
      }
    }
    return out.trim();
  }

  static formatEvalOrigin(site, origin) {
    const specifier = origin.getSpecifier();
    if (specifier) {
      return specifier;
    }
    let out = 'eval at ';

    const name = site.getFunctionName();
    if (name) {
      out += name;
    } else {
      out += '<anonymous>';
    }

    if (origin.lineNumber !== null) {
      out += `:${origin.lineNumber}`;
      if (origin.columnNumber !== null) {
        out += `:${origin.columnNumber}`;
      }
    }

    out += ', ';

    return out;
  }

  toString() {
    const isAsync = this.isAsync();
    const functionName = this.getFunctionName();
    const isMethodCall = !(this.isToplevel || this.isConstructor);

    let string = isAsync ? 'async ' : '';

    if (isMethodCall) {
      const methodName = this.getMethodName();
      if (functionName) {
        string += functionName;
        if (methodName && functionName !== methodName && !methodName.endsWith(functionName)) {
          string += ` [as ${methodName}]`;
        }
      } else if (methodName) {
        string += methodName;
      } else {
        string += '<anonymous>';
      }
    } else if (this.isConstructor) {
      string += 'new ';
      if (functionName) {
        string += functionName;
      } else {
        string += '<anonymous>';
      }
    } else if (functionName) {
      string += functionName;
    } else {
      return `${string}${CallSite.loc(this)}`;
    }

    return `${string} (${CallSite.loc(this)})`;
  }
}

export function unwind(iterator, maxSteps = 1) {
  let steps = 0;
  while (true) {
    const { done, value } = iterator.next('Unwind');
    if (done) {
      return value;
    }
    steps += 1;
    if (steps > maxSteps) {
      throw new RangeError('Max steps exceeded');
    }
  }
}

const kSafeToResume = Symbol('kSameToResume');

export function handleInResume(fn, ...args) {
  const bound = () => fn(...args);
  bound[kSafeToResume] = true;
  return bound;
}

export function resume(context, completion) {
  const { value } = context.codeEvaluationState.next(completion);
  if (typeof value === 'function' && value[kSafeToResume] === true) {
    return X(value());
  }
  return value;
}

function inlineInspect(V) {
  return inspect(V, surroundingAgent.currentRealmRecord, true);
}

const kMaxAsyncFrames = 8;
function captureAsyncStackTrace(stack, promise) {
  let added = 0;
  while (added < kMaxAsyncFrames) {
    if (promise.PromiseFulfillReactions.length !== 1) {
      return;
    }
    const [reaction] = promise.PromiseFulfillReactions;
    if (reaction.Handler.nativeFunction === AwaitFulfilledFunctions) {
      const asyncContext = reaction.Handler.AsyncContext;
      stack.push(asyncContext.callSite);
      added += 1;
      if ('PromiseState' in asyncContext.promiseCapability.Promise) {
        promise = asyncContext.promiseCapability.Promise;
      } else {
        return;
      }
    } else {
      if ('PromiseState' in reaction.Capability.Promise) {
        promise = reaction.Capability.Promise;
      } else {
        return;
      }
    }
  }
}

export function captureStack(O) {
  const stack = [];

  for (const e of surroundingAgent.executionContextStack.slice(0, -1).reverse()) {
    stack.push(e.callSite);
    if (e.callSite.isToplevel) {
      break;
    }
  }

  if (stack[0].context.promiseCapability) {
    stack.pop();
    captureAsyncStackTrace(stack, stack[0].context.promiseCapability.Promise);
  }

  const errorString = X(ToString(O)).stringValue();
  const trace = `${errorString}${stack.map((s) => `\n  at ${s}`).join('')}`;

  X(DefinePropertyOrThrow(O, new Value('stack'), Descriptor({
    Value: new Value(trace),
    Writable: Value.true,
    Enumerable: Value.false,
    Configurable: Value.false,
  })));
}

const messages = {
  AlreadyDeclared: (n) => `${inlineInspect(n)} is already declared`,
  ArrayPastSafeLength: () => 'Cannot make length of array-like object surpass the bounds of an integer index',
  BufferDetachKeyMismatch: (k, b) => `${inlineInspect(k)} is not the [[ArrayBufferDetachKey]] of ${inlineInspect(b)}`,
  BufferDetached: () => 'Cannot operate on detached ArrayBuffer',
  CannotConvertSymbol: (t) => `Cannot convert a Symbol value to a ${t}`,
  CannotConvertToObject: (t) => `Cannot convert ${t} to object`,
  CannotSetProperty: (p, o) => `Cannot set property ${inlineInspect(p)} on ${inlineInspect(o)}`,
  ConstructorRequiresNew: (n) => `${n} constructor requires new`,
  CouldNotResolveModule: (s) => `Could not resolve module ${inlineInspect(s)}`,
  DataViewOOB: () => 'Offset is outside the bounds of the DataView',
  InternalSlotMissing: (o, s) => `Internal slot ${s} is missing for ${inlineInspect(o)}`,
  InvalidHint: (v) => `Invalid hint: ${inlineInspect(v)}`,
  InvalidRegExpFlags: (f) => `Invalid RegExp flags: ${f}`,
  NegativeIndex: (n = 'Index') => `${n} cannot be negative`,
  NotAConstructor: (v) => `${inlineInspect(v)} is not a constructor`,
  NotAFunction: (v) => `${inlineInspect(v)} is not a function`,
  NotATypeObject: (t, v) => `${inlineInspect(v)} is not a ${t} object`,
  NotAnObject: (v) => `${inlineInspect(v)} is not an object`,
  NotAnTypeObject: (t, v) => `${inlineInspect(v)} is not an ${t} object`,
  NotDefined: (n) => `${inlineInspect(n)} is not defined`,
  ObjectToPrimitive: () => 'Cannot convert object to primitive value',
  OutOfRange: (n) => `${n} is out of range`,
  PromiseRejectFunction: (v) => `Promise reject function ${inlineInspect(v)} is not callable`,
  PromiseResolveFunction: (v) => `Promise resolve function ${inlineInspect(v)} is not callable`,
  ProxyRevoked: (n) => `Cannot perform '${n}' on a proxy that has been revoked`,
  RegExpArgumentNotAllowed: (m) => `First argument to ${m} must not be a regular expression`,
  ResolutionNullOrAmbiguous: (r, n, m) => (r === null
    ? `Could not resolve import ${inlineInspect(n)} from ${m.HostDefined.specifier}`
    : `Star export ${inlineInspect(n)} from ${m.HostDefined.specifier} is ambiguous`),
  StrictModeDelete: (n) => `Cannot not delete property ${inlineInspect(n)}`,
  StringRepeatCount: (v) => `Count ${inlineInspect(v)} is invalid`,
  SubclassLengthTooSmall: (v) => `Subclass constructor returned a smaller-than-requested object ${inlineInspect(v)}`,
  SubclassSameValue: (v) => `Subclass constructor returned the same object ${inlineInspect(v)}`,
  TypedArrayCreationOOB: () => 'Sum of start offset and byte length should be less than the size of underlying buffer',
  TypedArrayLengthAlignment: (n, m) => `Size of ${n} should be a multiple of ${m}`,
  TypedArrayOOB: () => 'Sum of start offset and byte length should be less than the size of the TypedArray',
  TypedArrayOffsetAlignment: (n, m) => `Start offset of ${n} should be a multiple of ${m}`,
  TypedArrayTooSmall: () => 'Derived TypedArray constructor created an array which was too small',
};

export function msg(key, ...args) {
  return messages[key](...args);
}
