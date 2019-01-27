import { GetNewTarget } from '../abstract-ops/all.mjs';

// 12.3.8.1 #sec-meta-properties-runtime-semantics-evaluation
// NewTarget : `new` `.` `target`
function* Evaluate_NewTarget() {
  return yield* GetNewTarget();
}

// #prod-MetaProperty
// MetaProperty : NewTarget
export function* Evaluate_MetaProperty() { // eslint-disable-line require-yield
  return Evaluate_NewTarget();
}
