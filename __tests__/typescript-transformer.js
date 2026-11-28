const ts = require('typescript');
const { createHash } = require('crypto');
const { readFileSync } = require('fs');

module.exports = {
  process(sourceText, sourcePath) {
    const result = ts.transpileModule(sourceText, {
      fileName: sourcePath,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        sourceMap: true,
      },
    });
    return { code: result.outputText, map: result.sourceMapText };
  },
  getCacheKey(sourceText, sourcePath, options) {
    return createHash('sha256')
      .update(sourceText).update(sourcePath).update(options.configString)
      .update(ts.version).update(readFileSync(__filename)).digest('hex');
  },
};
