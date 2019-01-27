import { surroundingAgent } from '../engine.mjs';
import {
  ArrayCreate,
  Assert,
  Call,
  Construct,
  CreateDataProperty,
  EscapeRegExpPattern,
  Get,
  IsCallable,
  SameValue,
  Set,
  SpeciesConstructor,
  ToBoolean,
  ToInteger,
  ToLength,
  ToString,
  ToUint32,
} from '../abstract-ops/all.mjs';
import { GetSubstitution } from '../runtime-semantics/all.mjs';
import {
  Type,
  Value,
  wellKnownSymbols,
} from '../value.mjs';
import { BootstrapPrototype } from './Bootstrap.mjs';
import { Q, X } from '../completion.mjs';
import { msg } from '../helpers.mjs';

// 21.2.5.2 #sec-regexp.prototype.exec
function* RegExpProto_exec([string = Value.undefined], { thisValue }) {
  const R = thisValue;
  if (Type(R) !== 'Object') {
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  if (!('RegExpMatcher' in R)) {
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  const S = Q(yield* ToString(string));
  return Q(RegExpBuiltinExec(R, S));
}

// 21.2.5.2.1 #sec-regexpexec
function* RegExpExec(R, S) {
  Assert(Type(R) === 'Object');
  Assert(Type(S) === 'String');

  const exec = Q(yield* Get(R, new Value('exec')));
  if (IsCallable(exec) === Value.true) {
    const result = Q(yield* Call(exec, R, [S]));
    if (Type(result) !== 'Object' && Type(result) !== 'Null') {
      // TODO: throw with an error message
      return surroundingAgent.Throw('TypeError');
    }
    return result;
  }
  if (!('RegExpMatcher' in R)) {
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  return Q(RegExpBuiltinExec(R, S));
}

// 21.2.5.2.2 #sec-regexpbuiltinexec
function* RegExpBuiltinExec(R, S) {
  Assert('RegExpMatcher' in R);
  Assert(Type(S) === 'String');
  const length = S.stringValue().length;
  const lastIndexStr = new Value('lastIndex');
  const lastIndexValue = Q(yield* Get(R, lastIndexStr));
  let lastIndex = Q(yield* ToLength(lastIndexValue));
  const flags = R.OriginalFlags.stringValue();
  const global = flags.includes('g');
  const sticky = flags.includes('y');
  if (!global && !sticky) {
    lastIndex = new Value(0);
  }
  const matcher = R.RegExpMatcher;
  const fullUnicode = flags.includes('u');
  let matchSucceeded = false;
  let r;
  while (matchSucceeded === false) {
    if (lastIndex.numberValue() > length) {
      if (global || sticky) {
        Q(yield* Set(R, lastIndexStr, new Value(0), Value.true));
      }
      return Value.null;
    }
    r = matcher(S, lastIndex);
    if (r === null) {
      if (sticky) {
        Q(yield* Set(R, lastIndexStr, new Value(0), Value.true));
        return Value.null;
      }
      lastIndex = AdvanceStringIndex(S, lastIndex, fullUnicode ? Value.true : Value.false);
    } else {
      // Assert: r is a state
      matchSucceeded = true;
    }
  }

  const e = r.endIndex;

  if (fullUnicode) {
    // TODO
  }

  if (global || sticky) {
    Q(yield* Set(R, lastIndexStr, e, Value.true));
  }

  const n = r.captures.length;
  Assert(n < (2 ** 32) - 1);
  const A = X(yield* ArrayCreate(new Value(n + 1)));
  // Assert: The value of A's "length" property is n + 1.
  X(yield* CreateDataProperty(A, new Value('index'), lastIndex));
  X(yield* CreateDataProperty(A, new Value('input'), S));
  const matchedSubstr = S.stringValue().substring(lastIndex.numberValue(), e.numberValue());
  X(yield* CreateDataProperty(A, new Value('0'), new Value(matchedSubstr)));

  let groups;
  if (R.GroupName) {
    // TODO
  } else {
    groups = Value.undefined;
  }
  X(yield* CreateDataProperty(A, new Value('groups'), groups));
  for (let i = 1; i <= n; i += 1) {
    const captureI = r.captures[i - 1];
    let captureValue;
    if (captureI === Value.undefined) {
      captureValue = Value.undefined;
    } else if (fullUnicode) {
      // Assert: captureI is a List of code points.
      captureValue = new Value(captureI.reduce((acc, codePoint) => acc + String.fromCodePoint(codePoint), ''));
    } else {
      // Assert: captureI is a List of code units.
      captureValue = new Value(captureI.reduce((acc, charCode) => acc + String.fromCharCode(charCode), ''));
    }
    X(yield* CreateDataProperty(A, X(yield* ToString(new Value(i))), captureValue));
    // TODO
  }

  return A;
}

// 21.2.5.2.3 #sec-advancestringindex
function AdvanceStringIndex(S, index, unicode) {
  Assert(Type(S) === 'String');
  index = index.numberValue();
  Assert(Number.isInteger(index) && index >= 0 && index <= (2 ** 53) - 1);
  Assert(Type(unicode) === 'Boolean');

  if (unicode === Value.false) {
    return new Value(index + 1);
  }

  const length = S.stringValue().length;
  if (index + 1 >= length) {
    return new Value(index + 1);
  }

  const first = S.stringValue().charCodeAt(index);
  if (first < 0xD800 || first > 0xDBFF) {
    return new Value(index + 1);
  }

  const second = S.stringValue().charCodeAt(index + 1);
  if (second < 0xDC00 || second > 0xDFFF) {
    return new Value(index + 1);
  }

  return new Value(index + 2);
}

// 21.2.5.3 #sec-get-regexp.prototype.dotall
function* RegExpProto_dotAllGetter(args, { thisValue }) {
  const R = thisValue;
  if (Type(R) !== 'Object') {
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  if (!('OriginalFlags' in R)) {
    if (SameValue(R, surroundingAgent.intrinsic('%RegExpPrototype%')) === Value.true) {
      return Value.undefined;
    }
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  const flags = R.OriginalFlags;
  if (flags.stringValue().includes('s')) {
    return Value.true;
  }
  return Value.false;
}

// 21.2.5.4 #sec-get-regexp.prototype.flags
function* RegExpProto_flagsGetter(args, { thisValue }) {
  const R = thisValue;
  if (Type(R) !== 'Object') {
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  let result = '';
  const global = ToBoolean(Q(yield* Get(R, new Value('global'))));
  if (global === Value.true) {
    result += 'g';
  }
  const ignoreCase = ToBoolean(Q(yield* Get(R, new Value('ignoreCase'))));
  if (ignoreCase === Value.true) {
    result += 'i';
  }
  const multiline = ToBoolean(Q(yield* Get(R, new Value('multiline'))));
  if (multiline === Value.true) {
    result += 'm';
  }
  const dotAll = ToBoolean(Q(yield* Get(R, new Value('dotAll'))));
  if (dotAll === Value.true) {
    result += 's';
  }
  const unicode = ToBoolean(Q(yield* Get(R, new Value('unicode'))));
  if (unicode === Value.true) {
    result += 'u';
  }
  const sticky = ToBoolean(Q(yield* Get(R, new Value('sticky'))));
  if (sticky === Value.true) {
    result += 'y';
  }
  return new Value(result);
}

// 21.2.5.5 #sec-get-regexp.prototype.global
function* RegExpProto_globalGetter(args, { thisValue }) {
  const R = thisValue;
  if (Type(R) !== 'Object') {
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  if (!('OriginalFlags' in R)) {
    if (SameValue(R, surroundingAgent.intrinsic('%RegExpPrototype%')) === Value.true) {
      return Value.undefined;
    }
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  const flags = R.OriginalFlags;
  if (flags.stringValue().includes('g')) {
    return Value.true;
  }
  return Value.false;
}

// 21.2.5.6 #sec-get-regexp.prototype.ignorecase
function* RegExpProto_ignoreCaseGetter(args, { thisValue }) {
  const R = thisValue;
  if (Type(R) !== 'Object') {
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  if (!('OriginalFlags' in R)) {
    if (SameValue(R, surroundingAgent.intrinsic('%RegExpPrototype%')) === Value.true) {
      return Value.undefined;
    }
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  const flags = R.OriginalFlags;
  if (flags.stringValue().includes('i')) {
    return Value.true;
  }
  return Value.false;
}

// 21.2.5.7 #sec-get-regexp.prototype-@@match
function* RegExpProto_match([string = Value.undefined], { thisValue }) {
  const rx = thisValue;
  if (Type(rx) !== 'Object') {
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', rx));
  }
  const S = Q(yield* ToString(string));

  const global = ToBoolean(Q(yield* Get(rx, new Value('global'))));
  if (global === Value.false) {
    return Q(RegExpExec(rx, S));
  } else {
    const fullUnicode = ToBoolean(Q(yield* Get(rx, new Value('unicode'))));
    Q(yield* Set(rx, new Value('lastIndex'), new Value(0), Value.true));
    const A = X(yield* ArrayCreate(new Value(0)));
    let n = 0;
    while (true) {
      const result = Q(RegExpExec(rx, S));
      if (result === Value.null) {
        if (n === 0) {
          return Value.null;
        }
        return A;
      } else {
        const firstResult = Q(yield* Get(result, new Value('0')));
        const matchStr = Q(yield* ToString(firstResult));
        const status = yield* CreateDataProperty(A, X(yield* ToString(new Value(n))), matchStr);
        Assert(status === Value.true);
        if (matchStr.stringValue() === '') {
          const lastIndex = Q(yield* Get(rx, new Value('lastIndex')));
          const thisIndex = Q(yield* ToLength(lastIndex));
          const nextIndex = AdvanceStringIndex(S, thisIndex, fullUnicode);
          Q(yield* Set(rx, new Value('lastIndex'), nextIndex, Value.true));
        }
        n += 1;
      }
    }
  }
}

// 21.2.5.8 #sec-get-regexp.prototype.multiline
function* RegExpProto_multilineGetter(args, { thisValue }) {
  const R = thisValue;
  if (Type(R) !== 'Object') {
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  if (!('OriginalFlags' in R)) {
    if (SameValue(R, surroundingAgent.intrinsic('%RegExpPrototype%')) === Value.true) {
      return Value.undefined;
    }
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  const flags = R.OriginalFlags;
  if (flags.stringValue().includes('m')) {
    return Value.true;
  }
  return Value.false;
}

// 21.2.5.9 #sec-get-regexp.prototype-@@replace
function* RegExpProto_replace([string = Value.undefined, replaceValue = Value.undefined], { thisValue }) {
  const rx = thisValue;
  if (Type(rx) !== 'Object') {
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', rx));
  }
  const S = Q(yield* ToString(string));
  const lengthS = S.stringValue().length;
  const functionalReplace = IsCallable(replaceValue);
  if (functionalReplace === Value.false) {
    replaceValue = Q(yield* ToString(replaceValue));
  }
  const global = ToBoolean(Q(yield* Get(rx, new Value('global'))));
  let fullUnicode;
  if (global === Value.true) {
    fullUnicode = ToBoolean(Q(yield* Get(rx, new Value('unicode'))));
    Q(yield* Set(rx, new Value('lastIndex'), new Value(0), Value.true));
  }

  const results = [];
  let done = false;
  while (!done) {
    const result = Q(RegExpExec(rx, S));
    if (result === Value.null) {
      done = true;
    } else {
      results.push(result);
      if (global === Value.false) {
        done = true;
      } else {
        const firstResult = Q(yield* Get(result, new Value('0')));
        const matchStr = Q(yield* ToString(firstResult));
        if (matchStr.stringValue() === '') {
          const lastIndex = Q(yield* Get(rx, new Value('lastIndex')));
          const thisIndex = Q(yield* ToLength(lastIndex));
          const nextIndex = AdvanceStringIndex(S, thisIndex, fullUnicode);
          Q(yield* Set(rx, new Value('lastIndex'), nextIndex, Value.true));
        }
      }
    }
  }

  let accumulatedResult = '';
  let nextSourcePosition = 0;
  for (const result of results) {
    const resultLength = Q(yield* Get(result, new Value('length')));
    let nCaptures = Q(yield* ToLength(resultLength)).numberValue();
    nCaptures = Math.max(nCaptures - 1, 0);

    const firstResult = Q(yield* Get(result, new Value('0')));
    const matched = Q(yield* ToString(firstResult));
    const matchLength = matched.stringValue().length;

    const resultIndex = Q(yield* Get(result, new Value('index')));
    let position = Q(yield* ToInteger(resultIndex));
    position = new Value(Math.max(Math.min(position.numberValue(), lengthS), 0));

    let n = 1;
    const captures = [];
    while (n <= nCaptures) {
      let capN = Q(yield* Get(result, X(yield* ToString(new Value(n)))));
      if (capN !== Value.undefined) {
        capN = Q(yield* ToString(capN));
      }
      captures.push(capN);
      n += 1;
    }

    const namedCaptures = Q(yield* Get(result, new Value('groups')));

    let replacement;
    if (functionalReplace === Value.true) {
      const replacerArgs = [matched];
      replacerArgs.push(...captures);
      replacerArgs.push(position, S);
      if (namedCaptures !== Value.undefined) {
        replacerArgs.push(namedCaptures);
      }
      const replValue = Q(yield* Call(replaceValue, Value.undefined, replacerArgs));
      replacement = Q(yield* ToString(replValue));
    } else {
      replacement = GetSubstitution(matched, S, position, captures, namedCaptures, replaceValue);
    }

    if (position.numberValue() >= nextSourcePosition) {
      accumulatedResult = accumulatedResult + S.stringValue().substring(nextSourcePosition, position.numberValue()) + replacement.stringValue();
      nextSourcePosition = position.numberValue() + matchLength;
    }
  }

  if (nextSourcePosition >= lengthS) {
    return new Value(accumulatedResult);
  }

  return new Value(accumulatedResult + S.stringValue().substring(nextSourcePosition));
}

// 21.2.5.10 #sec-get-regexp.prototype-@@search
function* RegExpProto_search([string = Value.undefined], { thisValue }) {
  const rx = thisValue;
  if (Type(rx) !== 'Object') {
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', rx));
  }
  const S = Q(yield* ToString(string));

  const previousLastIndex = Q(yield* Get(rx, new Value('lastIndex')));
  if (SameValue(previousLastIndex, new Value(0)) === Value.false) {
    Q(yield* Set(rx, new Value('lastIndex'), new Value(0), Value.true));
  }

  const result = Q(RegExpExec(rx, S));
  const currentLastIndex = Q(yield* Get(rx, new Value('lastIndex')));
  if (SameValue(currentLastIndex, previousLastIndex) === Value.false) {
    Q(yield* Set(rx, new Value('lastIndex'), previousLastIndex, Value.true));
  }

  if (result === Value.null) {
    return new Value(-1);
  }

  return Q(yield* Get(result, new Value('index')));
}

// 21.2.5.11 #sec-get-regexp.prototype.source
function* RegExpProto_sourceGetter(args, { thisValue }) {
  const R = thisValue;
  if (Type(R) !== 'Object') {
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  if (!('OriginalSource' in R)) {
    if (SameValue(R, surroundingAgent.intrinsic('%RegExpPrototype%')) === Value.true) {
      return new Value('(?:)');
    }
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  Assert('OriginalFlags' in R);
  const src = R.OriginalSource;
  const flags = R.OriginalFlags;
  return EscapeRegExpPattern(src, flags);
}

// 21.2.5.12 #sec-get-regexp.prototype-@@split
function* RegExpProto_split([string = Value.undefined, limit = Value.undefined], { thisValue }) {
  const rx = thisValue;
  if (Type(rx) !== 'Object') {
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', rx));
  }
  const S = Q(yield* ToString(string));

  const C = Q(yield* SpeciesConstructor(rx, surroundingAgent.intrinsic('%RegExp%')));
  const flagsValue = Q(yield* Get(rx, new Value('flags')));
  const flags = Q(yield* ToString(flagsValue)).stringValue();
  const unicodeMatching = flags.includes('u') ? Value.true : Value.false;
  const newFlags = flags.includes('y') ? new Value(flags) : new Value(`${flags}y`);
  const splitter = Q(yield* Construct(C, [rx, newFlags]));

  const A = X(yield* ArrayCreate(new Value(0)));
  let lengthA = 0;

  let lim;
  if (limit === Value.undefined) {
    lim = (2 ** 32) - 1;
  } else {
    lim = Q(yield* ToUint32(limit)).numberValue();
  }

  const size = S.stringValue().length;
  let p = 0;

  if (lim === 0) {
    return A;
  }

  if (size === 0) {
    const z = Q(RegExpExec(splitter, S));
    if (z !== Value.null) {
      return A;
    }
    X(yield* CreateDataProperty(A, new Value('0'), S));
    return A;
  }

  let q = new Value(p);
  while (q.numberValue() < size) {
    Q(yield* Set(splitter, new Value('lastIndex'), q, Value.true));
    const z = Q(RegExpExec(splitter, S));
    if (z === Value.null) {
      q = AdvanceStringIndex(S, q, unicodeMatching);
    } else {
      const lastIndex = Q(yield* Get(splitter, new Value('lastIndex')));
      let e = Q(yield* ToLength(lastIndex));
      e = new Value(Math.min(e.numberValue(), size));
      if (e.numberValue() === p) {
        q = AdvanceStringIndex(S, q, unicodeMatching);
      } else {
        const T = new Value(S.stringValue().substring(p, q.numberValue()));
        X(yield* CreateDataProperty(A, X(yield* ToString(new Value(lengthA))), T));
        lengthA += 1;
        if (lengthA === lim) {
          return A;
        }
        p = e.numberValue();
        const zLength = Q(yield* Get(z, new Value('length')));
        let numberOfCaptures = Q(yield* ToLength(zLength)).numberValue();
        numberOfCaptures = Math.max(numberOfCaptures - 1, 0);
        let i = 1;
        while (i <= numberOfCaptures) {
          const nextCapture = Q(yield* Get(z, X(yield* ToString(new Value(i)))));
          X(yield* CreateDataProperty(A, X(yield* ToString(new Value(lengthA))), nextCapture));
          i += 1;
          lengthA += 1;
          if (lengthA === lim) {
            return A;
          }
        }
        q = new Value(p);
      }
    }
  }

  const T = new Value(S.stringValue().substring(p, size));
  X(yield* CreateDataProperty(A, X(yield* ToString(new Value(lengthA))), T));
  return A;
}

// 21.2.5.13 #sec-get-regexp.prototype.sticky
function* RegExpProto_stickyGetter(args, { thisValue }) {
  const R = thisValue;
  if (Type(R) !== 'Object') {
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  if (!('OriginalFlags' in R)) {
    if (SameValue(R, surroundingAgent.intrinsic('%RegExpPrototype%')) === Value.true) {
      return Value.undefined;
    }
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  const flags = R.OriginalFlags;
  if (flags.stringValue().includes('y')) {
    return Value.true;
  }
  return Value.false;
}

// 21.2.5.14 #sec-get-regexp.prototype.test
function* RegExpProto_test([S = Value.undefined], { thisValue }) {
  const R = thisValue;
  if (Type(R) !== 'Object') {
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  const string = Q(yield* ToString(S));
  const match = Q(RegExpExec(R, string));
  if (match !== Value.null) {
    return Value.true;
  }
  return Value.false;
}

// 21.2.5.15 #sec-get-regexp.prototype.toString
function* RegExpProto_toString(args, { thisValue }) {
  const R = thisValue;
  if (Type(R) !== 'Object') {
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  const pattern = Q(yield* ToString(Q(yield* Get(R, new Value('source')))));
  const flags = Q(yield* ToString(Q(yield* Get(R, new Value('flags')))));
  const result = `/${pattern.stringValue()}/${flags.stringValue()}`;
  return new Value(result);
}

// 21.2.5.16 #sec-get-regexp.prototype.unicode
function* RegExpProto_unicodeGetter(args, { thisValue }) {
  const R = thisValue;
  if (Type(R) !== 'Object') {
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  if (!('OriginalFlags' in R)) {
    if (SameValue(R, surroundingAgent.intrinsic('%RegExpPrototype%')) === Value.true) {
      return Value.undefined;
    }
    return surroundingAgent.Throw('TypeError', msg('NotATypeObject', 'RegExp', R));
  }
  const flags = R.OriginalFlags;
  if (flags.stringValue().includes('u')) {
    return Value.true;
  }
  return Value.false;
}

export function CreateRegExpPrototype(realmRec) {
  const proto = BootstrapPrototype(
    realmRec,
    [
      ['exec', RegExpProto_exec, 1],
      ['dotAll', [RegExpProto_dotAllGetter]],
      ['flags', [RegExpProto_flagsGetter]],
      ['global', [RegExpProto_globalGetter]],
      ['ignoreCase', [RegExpProto_ignoreCaseGetter]],
      [wellKnownSymbols.match, RegExpProto_match, 1],
      ['multiline', [RegExpProto_multilineGetter]],
      [wellKnownSymbols.replace, RegExpProto_replace, 2],
      [wellKnownSymbols.search, RegExpProto_search, 1],
      ['source', [RegExpProto_sourceGetter]],
      [wellKnownSymbols.split, RegExpProto_split, 2],
      ['sticky', [RegExpProto_stickyGetter]],
      ['test', RegExpProto_test, 1],
      ['toString', RegExpProto_toString, 0],
      ['unicode', [RegExpProto_unicodeGetter]],
    ],
    realmRec.Intrinsics['%ObjectPrototype%'],
  );

  realmRec.Intrinsics['%RegExpPrototype%'] = proto;
}
