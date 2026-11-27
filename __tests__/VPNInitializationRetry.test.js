const React = require('react');
const { act, create } = require('react-test-renderer');
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

jest.mock('react-native', () => ({ Alert: { alert: jest.fn() } }), { virtual: true });
jest.mock('react-native-wireguard-vpn-connect', () => ({
  initialize: jest.fn(), connect: jest.fn(), disconnect: jest.fn(), getStatus: jest.fn(),
}), { virtual: true });
const native = require('react-native-wireguard-vpn-connect');
const { Alert } = require('react-native');
const source = require('../src/components/VPNProvider');
// The package's compiled React Native entry retains JSX; execute it as a consumer transpiler would.
const compiledFile = path.resolve(__dirname, '../dist/components/VPNProvider.js');
const compiled = { exports: {} };
new Function('require', 'module', 'exports', 'React', ts.transpileModule(fs.readFileSync(compiledFile, 'utf8'), {
  fileName: 'VPNProvider.tsx',
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText)(require, compiled, compiled.exports, React);

const config = { privateKey: 'test-private', publicKey: 'test-public', address: '10.0.0.2/32',
  serverAddress: 'example.test', serverPort: 51820, allowedIPs: ['0.0.0.0/0'] };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe.each([['source', source], ['compiled', compiled.exports]])('%s VPN initialization retry', (_, sdk) => {
  let renderer, current;
  const mount = async () => {
    function Consumer() { current = sdk.useVPN(); return null; }
    await act(async () => { renderer = create(React.createElement(sdk.VPNProvider, null, React.createElement(Consumer))); });
  };
  const unmount = () => { act(() => renderer.unmount()); renderer = null; };
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    native.getStatus.mockResolvedValue({ isConnected: false });
    native.initialize.mockRejectedValueOnce(new Error('VPN permission required'));
  });
  afterEach(() => { if (renderer) unmount(); jest.restoreAllMocks(); });

  test('explicitly retries after the initial permission failure and allows connection', async () => {
    await mount();
    expect(current.isInitialized).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Initialization Error', 'VPN permission required');
    const retry = current.initializeVPN;
    await act(async () => { await current.initializeVPN(); });
    expect(native.initialize).toHaveBeenCalledTimes(2);
    expect(current.isInitialized).toBe(true);
    expect(current.initializeVPN).toBe(retry);
    expect(native.getStatus).toHaveBeenCalledTimes(1);
    await act(async () => { await current.connectVPN(config); });
    expect(native.connect).toHaveBeenCalledWith(config);
  });

  test('connects through the callback retained by the explicit retry handler', async () => {
    await mount();
    const { initializeVPN, connectVPN } = current;
    await act(async () => { await initializeVPN(); await connectVPN(config); });
    expect(native.connect).toHaveBeenCalledWith(config);
    expect(current.isInitialized).toBe(true);
  });

  test('shares one pending explicit retry and keeps connection blocked until ready', async () => {
    await mount();
    const pending = deferred(); native.initialize.mockReturnValueOnce(pending.promise);
    let first, second;
    act(() => { first = current.initializeVPN(); second = current.initializeVPN(); });
    expect(second).toBe(first);
    await act(async () => { await Promise.resolve(); await current.connectVPN(config); });
    expect(native.initialize).toHaveBeenCalledTimes(2);
    expect(native.connect).not.toHaveBeenCalled();
    expect(current.isInitialized).toBe(false);
    await act(async () => { pending.resolve(); await Promise.all([first, second]); });
    expect(current.isInitialized).toBe(true);
    expect(native.getStatus).toHaveBeenCalledTimes(1);
  });

  test('shares the mount attempt instead of starting another native initialization', async () => {
    const pending = deferred(); native.initialize.mockReset().mockReturnValueOnce(pending.promise);
    await mount();
    let retry;
    act(() => { retry = current.initializeVPN(); });
    expect(native.initialize).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(); await retry; });
    expect(current.isInitialized).toBe(true);
  });

  test('does not repeat successful initialization', async () => {
    native.initialize.mockReset().mockResolvedValue(undefined);
    await mount();
    await act(async () => { await current.initializeVPN(); await current.initializeVPN(); });
    expect(native.initialize).toHaveBeenCalledTimes(1);
    expect(native.getStatus).toHaveBeenCalledTimes(1);
  });

  test.each(['reject', 'throw'])('permits another retry after a native %s', async failure => {
    await mount();
    if (failure === 'reject') native.initialize.mockRejectedValueOnce(new Error('still unavailable'));
    else native.initialize.mockImplementationOnce(() => { throw new Error('still unavailable'); });
    await act(async () => { await current.initializeVPN(); });
    expect(current.isInitialized).toBe(false);
    expect(Alert.alert).toHaveBeenLastCalledWith('Initialization Error', 'still unavailable');
    await act(async () => { await current.initializeVPN(); });
    expect(native.initialize).toHaveBeenCalledTimes(3);
    expect(current.isInitialized).toBe(true);
  });

  test.each(['resolve', 'reject'])('suppresses late retry %s after unmount', async result => {
    await mount();
    Alert.alert.mockClear(); console.error.mockClear();
    const pending = deferred(); native.initialize.mockReturnValueOnce(pending.promise);
    let retry;
    await act(async () => { retry = current.initializeVPN(); await Promise.resolve(); });
    const saved = current.initializeVPN;
    unmount();
    await act(async () => {
      if (result === 'resolve') pending.resolve(); else pending.reject(new Error('obsolete'));
      await retry; await saved();
    });
    expect(native.initialize).toHaveBeenCalledTimes(2);
    expect(native.getStatus).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test('waits for an obsolete effect attempt before initializing the current lifecycle', async () => {
    const first = deferred(), second = deferred();
    native.initialize.mockReset().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const useEffect = React.useEffect;
    let setup, cleanup;
    jest.spyOn(React, 'useEffect').mockImplementation(effect => {
      setup = effect;
      return useEffect(() => { cleanup = effect(); return cleanup; }, []);
    });
    await mount();
    act(() => { cleanup(); cleanup = setup(); });
    expect(native.initialize).toHaveBeenCalledTimes(1);
    await act(async () => { first.resolve(); await Promise.resolve(); });
    expect(current.isInitialized).toBe(false);
    expect(native.getStatus).not.toHaveBeenCalled();
    expect(native.initialize).toHaveBeenCalledTimes(2);
    await act(async () => { second.resolve(); await Promise.resolve(); });
    expect(current.isInitialized).toBe(true);
    expect(native.getStatus).toHaveBeenCalledTimes(1);
    act(() => cleanup());
  });

  test('does not start a queued retry when unmounted before its microtask', async () => {
    await mount();
    let retry;
    act(() => { retry = current.initializeVPN(); renderer.unmount(); renderer = null; });
    await act(async () => { await retry; });
    expect(native.initialize).toHaveBeenCalledTimes(1);
  });
});
