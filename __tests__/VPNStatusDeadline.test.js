const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');

jest.mock('react-native', () => ({ Alert: { alert: jest.fn() } }), { virtual: true });
jest.mock('react-native-wireguard-vpn-connect', () => ({
  initialize: jest.fn(), connect: jest.fn(), disconnect: jest.fn(), getStatus: jest.fn(),
}), { virtual: true });

const native = require('react-native-wireguard-vpn-connect');
const { Alert } = require('react-native');
const config = {
  privateKey: 'private', publicKey: 'public', address: '10.0.0.2/32',
  serverAddress: 'example.test', serverPort: 51820, allowedIPs: ['0.0.0.0/0'],
};
const initialStatus = { isConnected: false };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

describe.each(['source', 'compiled'])('%s native status deadlines', entry => {
  const load = () => {
    if (entry === 'source') return require('../src/components/VPNProvider');
    // The published React Native output retains JSX; compile that syntax only.
    const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../dist/components/VPNProvider.js'), 'utf8'), {
      fileName: 'VPNProvider.tsx',
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, jsxFactory: 'react_1.default.createElement' },
    }).outputText;
    const context = {
      exports: {}, require, console,
      setTimeout: (...args) => setTimeout(...args), clearTimeout: timer => clearTimeout(timer),
    };
    vm.runInNewContext(source, context);
    return context.exports;
  };
  const { VPNProvider, useVPN } = load();
  let renderer, current;
  const mount = async () => {
    function Consumer() { current = useVPN(); return null; }
    await act(async () => { renderer = create(React.createElement(VPNProvider, null, React.createElement(Consumer))); });
  };
  const advance = async milliseconds => {
    await act(async () => { await jest.advanceTimersByTimeAsync(milliseconds); });
  };
  const startRead = async () => {
    const pending = deferred();
    native.getStatus.mockReturnValueOnce(pending.promise);
    let settled = false;
    await act(async () => { void current.updateStatus().then(() => { settled = true; }); });
    return { ...pending, settled: () => settled };
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    native.getStatus.mockResolvedValue(initialStatus);
    await mount();
  });
  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    renderer = null;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test.each(['success', 'failure'])('settles a stalled read at its deadline and ignores late %s', async outcome => {
    const pending = await startRead();
    await advance(29_999);
    expect(pending.settled()).toBe(false);
    await advance(1);
    expect(pending.settled()).toBe(true);
    expect(current.vpnStatus).toEqual(initialStatus);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error.mock.calls[0][0]).toBe('Failed to get VPN status:');
    expect(console.error.mock.calls[0][1].message).toBe('VPN status request timed out');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    expect(native.getStatus).toHaveBeenCalledTimes(2);
    await act(async () => {
      if (outcome === 'success') pending.resolve({ isConnected: true });
      else pending.reject(new Error('late status failure'));
    });
    expect(current.vpnStatus).toEqual(initialStatus);
    expect(console.error).toHaveBeenCalledTimes(1);
    native.getStatus.mockResolvedValueOnce({ isConnected: true });
    await act(async () => { await current.updateStatus(); });
    expect(current.vpnStatus).toEqual({ isConnected: true });
    expect(jest.getTimerCount()).toBe(0);
  });

  test.each(['success', 'rejection', 'synchronous throw'])('clears the deadline after native %s', async outcome => {
    const failure = new Error('status unavailable');
    if (outcome === 'success') native.getStatus.mockResolvedValueOnce({ isConnected: true });
    if (outcome === 'rejection') native.getStatus.mockRejectedValueOnce(failure);
    if (outcome === 'synchronous throw') native.getStatus.mockImplementationOnce(() => { throw failure; });
    await act(async () => { await current.updateStatus(); });
    expect(jest.getTimerCount()).toBe(0);
    expect(current.vpnStatus).toEqual(outcome === 'success' ? { isConnected: true } : initialStatus);
    expect(console.error).toHaveBeenCalledTimes(outcome === 'success' ? 0 : 1);
    await advance(60_000);
    expect(console.error).toHaveBeenCalledTimes(outcome === 'success' ? 0 : 1);
  });

  test.each(['success', 'failure'])('settles a superseded read, keeping only the newer deadline before late %s', async outcome => {
    const old = await startRead();
    await advance(20_000);
    const latest = await startRead();
    expect(old.settled()).toBe(true);
    expect(latest.settled()).toBe(false);
    expect(jest.getTimerCount()).toBe(1);
    await act(async () => {
      if (outcome === 'success') old.resolve({ isConnected: true, tunnelState: 'old' });
      else old.reject(new Error('obsolete status failure'));
    });
    expect(current.vpnStatus).toEqual(initialStatus);
    expect(console.error).not.toHaveBeenCalled();
    await advance(29_999);
    expect(latest.settled()).toBe(false);
    await act(async () => { latest.resolve({ isConnected: true, tunnelState: 'latest' }); });
    expect(latest.settled()).toBe(true);
    expect(current.vpnStatus).toEqual({ isConnected: true, tunnelState: 'latest' });
    expect(jest.getTimerCount()).toBe(0);
    await advance(60_000);
    expect(console.error).not.toHaveBeenCalled();
  });

  test.each(['success', 'failure'])('settles a status wait and clears its deadline on unmount before late %s', async outcome => {
    const pending = await startRead();
    const retainedRefresh = current.updateStatus;
    await act(async () => { renderer.unmount(); });
    renderer = null;
    expect(pending.settled()).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    await act(async () => {
      if (outcome === 'success') pending.resolve({ isConnected: true });
      else pending.reject(new Error('late status failure'));
      await retainedRefresh();
    });
    await advance(60_000);
    expect(native.getStatus).toHaveBeenCalledTimes(2);
    expect(console.error).not.toHaveBeenCalled();
  });

  test.each(['connect', 'disconnect'])('releases %s ownership after its post-operation status deadline', async operation => {
    const pending = deferred();
    native.getStatus.mockReturnValueOnce(pending.promise);
    let settled = false;
    await act(async () => {
      void (operation === 'connect' ? current.connectVPN(config) : current.disconnectVPN())
        .then(() => { settled = true; });
    });
    const busy = () => operation === 'connect' ? current.isConnecting : current.isDisconnecting;
    expect(busy()).toBe(true);
    expect(native[operation]).toHaveBeenCalledTimes(1);
    await advance(29_999);
    await act(async () => { await current.connectVPN(config); await current.disconnectVPN(); });
    expect(native.connect).toHaveBeenCalledTimes(operation === 'connect' ? 1 : 0);
    expect(native.disconnect).toHaveBeenCalledTimes(operation === 'disconnect' ? 1 : 0);
    await advance(1);
    expect(settled).toBe(true);
    expect(busy()).toBe(false);
    expect(current.vpnStatus).toEqual(initialStatus);
    expect(Alert.alert).not.toHaveBeenCalled();
    await act(async () => {
      if (operation === 'connect') await current.disconnectVPN();
      else await current.connectVPN(config);
    });
    expect(native.connect).toHaveBeenCalledTimes(1);
    expect(native.disconnect).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve({ isConnected: true, tunnelState: 'obsolete' }); });
    expect(current.vpnStatus).toEqual(initialStatus);
    expect(jest.getTimerCount()).toBe(0);
  });

  test.each(['connect', 'disconnect'])('retains ownership while native %s itself is pending', async operation => {
    const pending = deferred();
    native[operation].mockReturnValueOnce(pending.promise);
    let completion;
    await act(async () => { completion = operation === 'connect' ? current.connectVPN(config) : current.disconnectVPN(); });
    await advance(60_000);
    expect(native.getStatus).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    expect(operation === 'connect' ? current.isConnecting : current.isDisconnecting).toBe(true);
    await act(async () => { await current.connectVPN(config); await current.disconnectVPN(); });
    expect(native.connect).toHaveBeenCalledTimes(operation === 'connect' ? 1 : 0);
    expect(native.disconnect).toHaveBeenCalledTimes(operation === 'disconnect' ? 1 : 0);
    await act(async () => { pending.resolve(); await completion; });
    expect(current.isConnecting).toBe(false);
    expect(current.isDisconnecting).toBe(false);
    expect(native.getStatus).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('bounds the initial status read after native initialization succeeds', async () => {
    await act(async () => { renderer.unmount(); });
    renderer = null;
    native.getStatus.mockClear().mockReturnValueOnce(new Promise(() => {}));
    await mount();
    expect(current.isInitialized).toBe(true);
    expect(current.vpnStatus).toBe(null);
    await advance(30_000);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(native.getStatus).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
