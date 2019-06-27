import { Value } from './value.mjs';
import { ParseModule, ParseScript } from './parse.mjs';
import {
  AbruptCompletion,
  EnsureCompletion,
  NormalCompletion,
  ThrowCompletion,
  Q, X,
} from './completion.mjs';
import {
  CreateRealm,
  SetDefaultGlobalBindings,
  SetRealmGlobalObject,
} from './realm.mjs';
import { Construct, Assert } from './abstract-ops/all.mjs';
import { GlobalDeclarationInstantiation } from './runtime-semantics/all.mjs';
import { Evaluate_Script } from './evaluator.mjs';
import { msg, CallSite } from './helpers.mjs';

export const FEATURES = Object.freeze([
  {
    name: 'globalThis',
    url: 'https://github.com/tc39/proposal-global',
  },
  {
    name: 'Promise.allSettled',
    url: 'https://github.com/tc39/proposal-promise-allSettled',
  },
].map(Object.freeze));

export class Agent {
  constructor(options = {}) {
    this.LittleEndian = Value.true;
    this.CanBlock = true;
    this.Signifier = Agent.Increment;
    Agent.Increment += 1;
    this.IsLockFree1 = true;
    this.IsLockFree2 = true;
    this.CandidateExecution = undefined;

    this.executionContextStack = [];
    const stackPop = this.executionContextStack.pop;
    this.executionContextStack.pop = function pop(...args) {
      const popped = stackPop.call(this);
      if (args.length === 1) {
        Assert(args[0] === popped);
      }
    };

    this.jobQueue = [];

    this.hostDefinedOptions = {
      ...options,
      features: FEATURES.reduce((acc, { name }) => {
        if (options.features) {
          acc[name] = options.features.includes(name);
        } else {
          acc[name] = false;
        }
        return acc;
      }, {}),
    };
  }

  get runningExecutionContext() {
    return this.executionContextStack[this.executionContextStack.length - 1];
  }

  get currentRealmRecord() {
    return this.runningExecutionContext.Realm;
  }

  get activeFunctionObject() {
    return this.runningExecutionContext.Function;
  }

  intrinsic(name) {
    return this.currentRealmRecord.Intrinsics[name];
  }

  Throw(type, message) {
    const cons = this.currentRealmRecord.Intrinsics[`%${type}%`];
    const error = Construct(cons, message ? [new Value(message)] : []);
    error.hostTrace = new Error().stack;
    return new ThrowCompletion(error);
  }

  feature(name) {
    return this.hostDefinedOptions.features[name];
  }
}
Agent.Increment = 0;

export let surroundingAgent;

export function setSurroundingAgent(a) {
  surroundingAgent = a;
}

export class ExecutionContext {
  constructor() {
    this.codeEvaluationState = undefined;
    this.Function = undefined;
    this.Realm = undefined;
    this.ScriptOrModule = undefined;
    this.LexicalEnvironment = undefined;

    this.callSite = new CallSite(this);
  }

  copy() {
    const e = new ExecutionContext();
    e.codeEvaluationState = this.codeEvaluationState;
    e.Function = this.Function;
    e.Realm = this.Realm;
    e.ScriptOrModule = this.ScriptOrModule;
    e.LexicalEnvironment = this.LexicalEnvironment;
    e.callSite = this.callSite.copy(e);
    return e;
  }
}

// 8.4.1 #sec-enqueuejob
export function EnqueueJob(queueName, job, args) {
  const callerContext = surroundingAgent.runningExecutionContext;
  const callerRealm = callerContext.Realm;
  const callerScriptOrModule = callerContext.ScriptOrModule;
  const pending = {
    Job: job,
    Arguments: args,
    Realm: callerRealm,
    ScriptOrModule: callerScriptOrModule,
    HostDefined: undefined,
  };
  surroundingAgent.jobQueue.push(pending);
}

// 8.5 #sec-initializehostdefinedrealm
export function InitializeHostDefinedRealm() {
  const realm = CreateRealm();
  const newContext = new ExecutionContext();
  newContext.Function = Value.null;
  newContext.Realm = realm;
  newContext.ScriptOrModule = Value.null;
  newContext.callSite.isToplevel = true;
  surroundingAgent.executionContextStack.push(newContext);
  const global = Value.undefined;
  const thisValue = Value.undefined;
  SetRealmGlobalObject(realm, global, thisValue);
  SetDefaultGlobalBindings(realm);
}

// 8.6 #sec-runjobs
export function RunJobs() {
  InitializeHostDefinedRealm();

  // In an implementation-dependent manner, obtain the ECMAScript source texts

  const scripts = [];

  const modules = [];

  scripts.forEach(({ sourceText, hostDefined }) => {
    EnqueueJob('ScriptJobs', ScriptEvaluationJob, [sourceText, hostDefined]);
  });

  modules.forEach(({ sourceText, hostDefined }) => {
    EnqueueJob('ScriptJobs', TopLevelModuleEvaluationJob, [sourceText, hostDefined]);
  });

  while (true) { // eslint-disable-line no-constant-condition
    surroundingAgent.executionContextStack.pop();
    const nextQueue = surroundingAgent.jobQueue;
    if (nextQueue.length === 0) {
      break;
    }
    const nextPending = nextQueue.shift();
    const newContext = new ExecutionContext();
    newContext.Function = Value.null;
    newContext.Realm = nextPending.Realm;
    newContext.ScriptOrModule = nextPending.ScriptOrModule;
    newContext.callSite.isToplevel = true;
    surroundingAgent.executionContextStack.push(newContext);
    const result = nextPending.Job(...nextPending.Arguments);
    if (result instanceof AbruptCompletion) {
      HostReportErrors([result.Value]);
    }
  }
}

// 8.7.1 #sec-agentsignifier
export function AgentSignifier() {
  const AR = surroundingAgent;
  return AR.Signifier;
}

// 15.1.10 #sec-runtime-semantics-scriptevaluation
export function ScriptEvaluation(scriptRecord) {
  const globalEnv = scriptRecord.Realm.GlobalEnv;
  const scriptCtx = new ExecutionContext();
  scriptCtx.Function = Value.null;
  scriptCtx.Realm = scriptRecord.Realm;
  scriptCtx.ScriptOrModule = scriptRecord;
  scriptCtx.VariableEnvironment = globalEnv;
  scriptCtx.LexicalEnvironment = globalEnv;
  scriptCtx.HostDefined = scriptRecord.HostDefined;
  scriptCtx.callSite.isToplevel = true;
  // Suspend runningExecutionContext
  surroundingAgent.executionContextStack.push(scriptCtx);
  const scriptBody = scriptRecord.ECMAScriptCode.body;
  let result = EnsureCompletion(GlobalDeclarationInstantiation(scriptBody, globalEnv));
  if (result.Type === 'normal') {
    result = Evaluate_Script(scriptBody, globalEnv);
  }
  if (result.Type === 'normal' && !result.Value) {
    result = new NormalCompletion(Value.undefined);
  }
  // Suspend scriptCtx
  surroundingAgent.executionContextStack.pop(scriptCtx);
  // Resume(surroundingAgent.runningExecutionContext);

  return result;
}

// 15.1.12 #sec-scriptevaluationjob
export function ScriptEvaluationJob(sourceText, hostDefined) {
  const realm = surroundingAgent.currentRealmRecord;
  const s = ParseScript(sourceText, realm, hostDefined);
  if (Array.isArray(s)) {
    HostReportErrors(s);
    return new NormalCompletion(undefined);
  }
  return ScriptEvaluation(s);
}

// 15.2.1.22 #sec-toplevelmoduleevaluationjob
export function TopLevelModuleEvaluationJob(sourceText, hostDefined) {
  const realm = surroundingAgent.currentRealmRecord;
  const m = ParseModule(sourceText, realm, hostDefined);
  m.Link();
  m.Evaluate();
}

// 16.1 #sec-host-report-errors
export function HostReportErrors(errorList) {
  if (surroundingAgent.hostDefinedOptions.reportError) {
    errorList.forEach((error) => {
      surroundingAgent.hostDefinedOptions.reportError(error);
    });
  }
}

export function HostEnsureCanCompileStrings(callerRealm, calleeRealm) {
  if (surroundingAgent.hostDefinedOptions.ensureCanCompileStrings !== undefined) {
    Q(surroundingAgent.hostDefinedOptions.ensureCanCompileStrings(callerRealm, calleeRealm));
  }
  return new NormalCompletion(undefined);
}

export function HostPromiseRejectionTracker(promise, operation) {
  if (surroundingAgent.hostDefinedOptions.promiseRejectionTracker) {
    X(surroundingAgent.hostDefinedOptions.promiseRejectionTracker(promise, operation));
  }
}

export function HostHasSourceTextAvailable(func) {
  if (surroundingAgent.hostDefinedOptions.hasSourceTextAvailable) {
    return X(surroundingAgent.hostDefinedOptions.hasSourceTextAvailable(func));
  }
  return Value.true;
}

export function HostResolveImportedModule(referencingModule, specifier) {
  const { Realm } = referencingModule;
  if (Realm.HostDefined.resolveImportedModule) {
    if (!Realm.HostDefined.moduleMap) {
      Realm.HostDefined.moduleMap = new Map();
    }
    specifier = specifier.stringValue();
    const key = `${referencingModule.HostDefined.specifier}\u0000${specifier}`;
    if (Realm.HostDefined.moduleMap.has(key)) {
      return Realm.HostDefined.moduleMap.get(key);
    }
    const apiModule = Q(Realm.HostDefined.resolveImportedModule(referencingModule.HostDefined.public, specifier));
    Realm.HostDefined.moduleMap.set(key, apiModule.module);
    return apiModule.module;
  }
  return surroundingAgent.Throw('Error', msg('CouldNotResolveModule', specifier));
}
