const ts = require('typescript');

module.exports = {
  process(sourceText, sourcePath) {
    return {
      code: ts.transpileModule(sourceText, {
        fileName: sourcePath,
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
          allowJs: true,
        },
      }).outputText,
    };
  },
};
