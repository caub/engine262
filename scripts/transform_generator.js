'use strict';

const fs = require('fs');
const recast = require('recast');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const acorn = require('acorn');
const engine262 = require('.');

const checks = Object.keys(engine262.Abstract)
  .filter((x) => x[0].toUpperCase() === x[0] && x !== 'Assert' && x !== 'Type' && !x.startsWith('Is'));

const source = fs.readFileSync(process.argv[2], 'utf8');

console.log(process.argv[2]);

const ast = recast.parse(source, {
  parser: {
    parse(src, opt) {
      return acorn.parse(src, { ...opt, sourceType: 'module', ecmaVersion: 2019 });
    },
  },
});

traverse(ast, {
  CallExpression(path) {
    if (path.node.checked) {
      return;
    }
    if (checks.includes(path.node.callee.name)) {
      const fn = path.findParent((p) => p.isFunction());
      fn.node.generator = true;
      path.node.checked = true;
      if (!path.parentPath.isYieldExpression() && !path.parentPath.isArrowFunctionExpression()) {
        path.replaceWith(t.yieldExpression(path.node, true));
      }
    }
  },
});

fs.writeFileSync(process.argv[2], recast.print(ast).code);
