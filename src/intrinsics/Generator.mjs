import { Descriptor, Value } from '../value.mjs';
import { BootstrapPrototype } from './Bootstrap.mjs';

export function CreateGenerator(realmRec) {
  const generatorPrototype = realmRec.Intrinsics['%GeneratorPrototype%'];

  const generator = BootstrapPrototype(realmRec, [
    ['prototype', generatorPrototype, undefined, { Writable: Value.false }],
  ], realmRec.Intrinsics['%FunctionPrototype%'], 'GeneratorFunction');

  generatorPrototype.properties.set(new Value('constructor'), Descriptor({
    Value: generator,
    Writable: Value.false,
    Enumerable: Value.false,
    Configurable: Value.true,
  }));

  realmRec.Intrinsics['%Generator%'] = generator;
}
