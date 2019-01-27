import { surroundingAgent } from '../engine.mjs';
import {
  Get,
  GetPrototypeFromConstructor,
  SameValue,
  StringCreate,
  SymbolDescriptiveString,
  ToInteger,
  ToLength,
  ToNumber,
  ToObject,
  ToString,
  ToUint16,
} from '../abstract-ops/all.mjs';
import { UTF16Encoding } from '../static-semantics/UTF16Encoding';
import {
  Type,
  Value,
} from '../value.mjs';
import { Q, X } from '../completion.mjs';
import { BootstrapConstructor } from './Bootstrap.mjs';

// 21.1.1.1 #sec-string-constructor-string-value
function* StringConstructor(args, { NewTarget }) {
  let s;
  if (args.length === 0) {
    // String ( )
    s = new Value('');
  } else {
    // String ( value )
    const [value] = args;
    if (NewTarget === Value.undefined && Type(value) === 'Symbol') {
      return X(SymbolDescriptiveString(value));
    }
    s = Q(yield* ToString(value));
  }
  if (NewTarget === Value.undefined) {
    return s;
  }
  return X(yield* StringCreate(s, Q(yield* GetPrototypeFromConstructor(NewTarget, '%StringPrototype%'))));
}

// 21.1.2.1 #sec-string.fromcharcode
function* String_fromCharCode(codeUnits) {
  const length = codeUnits.length;
  const elements = [];
  let nextIndex = 0;
  while (nextIndex < length) {
    const next = codeUnits[nextIndex];
    const nextCU = Q(yield* ToUint16(next));
    elements.push(nextCU);
    nextIndex += 1;
  }
  const result = elements.reduce((previous, current) => previous + String.fromCharCode(current.numberValue()), '');
  return new Value(result);
}

// 21.1.2.2 #sec-string.fromcodepoint
function* String_fromCodePoint(codePoints) {
  const length = codePoints.length;
  const elements = [];
  let nextIndex = 0;
  while (nextIndex < length) {
    const next = codePoints[nextIndex];
    const nextCP = Q(yield* ToNumber(next));
    if (SameValue(nextCP, X(yield* ToInteger(nextCP))) === Value.false) {
      return surroundingAgent.Throw('RangeError');
    }
    if (nextCP.numberValue() < 0 || nextCP.numberValue() > 0x10FFFF) {
      return surroundingAgent.Throw('RangeError');
    }
    elements.push(...UTF16Encoding(nextCP.numberValue()));
    nextIndex += 1;
  }
  const result = elements.reduce((previous, current) => previous + String.fromCharCode(current), '');
  return new Value(result);
}

// 21.1.2.4 #sec-string.raw
function* String_raw([template = Value.undefined, ...substitutions]) {
  const numberOfSubstitutions = substitutions.length;
  const cooked = Q(yield* ToObject(template));
  const rawProp = Q(yield* Get(cooked, new Value('raw')));
  const raw = Q(yield* ToObject(rawProp));
  const lenProp = Q(yield* Get(raw, new Value('length')));
  const literalSegments = Q(yield* ToLength(lenProp)).numberValue();
  if (literalSegments <= 0) {
    return new Value('');
  }
  // Not sure why the spec uses a List, but this is really just a String.
  const stringElements = [];
  let nextIndex = 0;
  while (true) {
    const nextKey = X(yield* ToString(new Value(nextIndex)));
    const nextSegProp = Q(yield* Get(raw, nextKey));
    const nextSeg = Q(yield* ToString(nextSegProp));
    stringElements.push(nextSeg.stringValue());
    if (nextIndex + 1 === literalSegments) {
      return new Value(stringElements.join(''));
    }
    let next;
    if (nextIndex < numberOfSubstitutions) {
      next = substitutions[nextIndex];
    } else {
      next = new Value('');
    }
    const nextSub = Q(yield* ToString(next));
    stringElements.push(nextSub.stringValue());
    nextIndex += 1;
  }
}

export function CreateString(realmRec) {
  const stringConstructor = BootstrapConstructor(realmRec, StringConstructor, 'String', 1, realmRec.Intrinsics['%StringPrototype%'], [
    ['fromCharCode', String_fromCharCode, 1],
    ['fromCodePoint', String_fromCodePoint, 1],
    ['raw', String_raw, 1],
  ]);

  realmRec.Intrinsics['%String%'] = stringConstructor;
}
