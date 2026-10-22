/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hook runs TypeScript tests without an extra dependency. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  module._compile(output.outputText, filename);
};
const names = ['x-social', 'event-fusion', 'viral-ranking', 'jev', 'twelvelabs', 'highlight-plan', 'highlight-optimizer', 'rolling-highlights', 'highlight-access', 'scoreplay', 'scoreplay-filters'];
for (const name of names) require(path.resolve(__dirname, '../src/lib', `${name}.test.ts`));
