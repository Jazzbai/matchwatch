/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hook runs TypeScript tests without an extra dependency. */
// Runs the highlight engine tests: node scripts/test-highlights.cjs
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  module._compile(output.outputText, filename);
};

const lib = path.resolve(__dirname, '../src/lib');
const testsIn = folder => fs.readdirSync(path.join(lib, folder)).filter(name => name.endsWith('.test.ts')).map(name => path.join(lib, folder, name));
const engine = [...testsIn('highlights'), ...testsIn('highlights/api')];
for (const file of [...engine, ...['scoreplay-mapping', 'scoreplay-filters', 'scoreplay', 'highlight-request', 'highlight-session'].map(name => path.join(lib, `${name}.test.ts`))]) require(file);
