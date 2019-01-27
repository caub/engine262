import { BootstrapPrototype } from './Bootstrap.mjs';
import { Descriptor, Value } from '../value.mjs';

export function CreateAsyncGenerator(realmRec) {
  const proto = BootstrapPrototype(realmRec, [
    ['prototype', realmRec.Intrinsics['%AsyncGeneratorPrototype%'], undefined, { Writable: Value.false }],
  ], realmRec.Intrinsics['%FunctionPrototype%'], 'AsyncGeneratorFunction');

  realmRec.Intrinsics['%AsyncGeneratorPrototype%'].properties.set(new Value('constructor'), Descriptor({
    Value: proto,
    Writable: Value.false,
    Enumerable: Value.false,
    Configurable: Value.true,
  }));

  realmRec.Intrinsics['%AsyncGenerator%'] = proto;
}
