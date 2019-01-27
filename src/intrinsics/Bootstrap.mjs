import {
  Assert,
  CreateBuiltinFunction,
  ObjectCreate,
  SetFunctionLength,
  SetFunctionName,
} from '../abstract-ops/all.mjs';
import {
  Descriptor,
  Value,
  wellKnownSymbols,
} from '../value.mjs';
import { X } from '../completion.mjs';
import { unwind } from '../helpers.mjs';

export function setFunctionProps(F, name, length, label) {
  X(unwind(SetFunctionName(F, name, label)));
  X(unwind(SetFunctionLength(F, length)));
}

// 17 #sec-ecmascript-standard-built-in-objects
export function assignProps(realmRec, obj, props) {
  for (const [n, v, len, descriptor] of props) {
    const name = n instanceof Value ? n : new Value(n);
    if (Array.isArray(v)) {
      // Every accessor property described in clauses 18 through 26 and in
      // Annex B.2 has the attributes { [[Enumerable]]: false,
      // [[Configurable]]: true } unless otherwise specified. If only a get
      // accessor function is described, the set accessor function is the
      // default value, undefined. If only a set accessor is described the get
      // accessor is the default value, undefined.
      let [
        getter = Value.undefined,
        setter = Value.undefined,
      ] = v;
      if (typeof getter === 'function') {
        getter = CreateBuiltinFunction(getter, [], realmRec);
        setFunctionProps(getter, name, new Value(0), new Value('get'));
      }
      if (typeof setter === 'function') {
        setter = CreateBuiltinFunction(setter, [], realmRec);
        setFunctionProps(setter, name, new Value(1), new Value('set'));
      }
      obj.properties.set(name, Descriptor({
        Get: getter,
        Set: setter,
        Enumerable: Value.false,
        Configurable: Value.true,
        ...descriptor,
      }));
    } else {
      // Every other data property described in clauses 18 through 26 and in
      // Annex B.2 has the attributes { [[Writable]]: true, [[Enumerable]]:
      // false, [[Configurable]]: true } unless otherwise specified.
      let value;
      if (typeof v === 'function') {
        Assert(typeof len === 'number');
        value = CreateBuiltinFunction(v, [], realmRec);
        setFunctionProps(value, name, new Value(len));
      } else {
        value = v;
      }
      obj.properties.set(name, Descriptor({
        Value: value,
        Writable: Value.true,
        Enumerable: Value.false,
        Configurable: Value.true,
        ...descriptor,
      }));
    }
  }
}

export function BootstrapPrototype(realmRec, props, Prototype, stringTag) {
  Assert(Prototype !== undefined);
  const proto = ObjectCreate(Prototype);

  assignProps(realmRec, proto, props);

  if (stringTag !== undefined) {
    proto.properties.set(wellKnownSymbols.toStringTag, Descriptor({
      Value: new Value(stringTag),
      Writable: Value.false,
      Enumerable: Value.false,
      Configurable: Value.true,
    }));
  }

  return proto;
}

export function BootstrapConstructor(realmRec, Constructor, name, length, Prototype, props) {
  const cons = CreateBuiltinFunction(Constructor, [], realmRec, undefined, Value.true);

  setFunctionProps(cons, new Value(name), new Value(length));

  cons.properties.set(new Value('prototype'), Descriptor({
    Value: Prototype,
    Writable: Value.false,
    Enumerable: Value.false,
    Configurable: Value.false,
  }));

  Prototype.properties.set(new Value('constructor'), Descriptor({
    Value: cons,
    Writable: Value.true,
    Enumerable: Value.false,
    Configurable: Value.true,
  }));

  assignProps(realmRec, cons, props);

  return cons;
}
