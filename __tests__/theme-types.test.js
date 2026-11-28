const path = require('path');
const ts = require('typescript');

describe.each(['src', 'dist'])('%s consumer theme types', (entry) => {
  test('accepts shared partial themes through root and component imports', () => {
    const root = path.resolve(__dirname, '..');
    const program = ts.createProgram([path.join(__dirname, 'fixtures/themes.tsx')], {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      baseUrl: root,
      paths: {
        'erebrus-react-native-sdk': [`${entry}/index`],
        'erebrus-react-native-sdk/*': [`${entry}/*`],
      },
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    expect(diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([]);
  });
});
