const React = require('react');
const { act, create } = require('react-test-renderer');

jest.mock('react-native', () => ({ Alert: { alert: jest.fn() } }), { virtual: true });
jest.mock('react-native-wireguard-vpn-connect', () => ({
  initialize: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  getStatus: jest.fn(),
}), { virtual: true });

const native = require('react-native-wireguard-vpn-connect');
const { VPNProvider, useVPN } = require('../src/components/VPNProvider');

const config = {
  privateKey: 'test-private', publicKey: 'test-public', address: '10.0.0.2/32',
  serverAddress: 'example.test', serverPort: 51820, allowedIPs: ['0.0.0.0/0'],
};

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('VPNProvider native operation ownership', () => {
  let renderer, current;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    native.getStatus.mockResolvedValue({ isConnected: false });
    function Consumer() { current = useVPN(); return null; }
    await act(async () => { renderer = create(React.createElement(VPNProvider, null, React.createElement(Consumer))); });
    expect(current.isInitialized).toBe(true);
  });

  afterEach(() => {
    act(() => renderer.unmount());
    jest.restoreAllMocks();
  });

  test('admits only one connect before React commits the busy state', async () => {
    const pending = deferred();
    native.connect.mockReturnValue(pending.promise);
    let first, second;
    act(() => { first = current.connectVPN(config); second = current.connectVPN(config); });
    expect(native.connect).toHaveBeenCalledTimes(1);
    expect(current.isConnecting).toBe(true);
    await act(async () => { pending.resolve(); await Promise.all([first, second]); });
    expect(current.isConnecting).toBe(false);
  });

  test('does not disconnect while a connect is pending', async () => {
    const pending = deferred();
    native.connect.mockReturnValue(pending.promise);
    let first;
    act(() => { first = current.connectVPN(config); });
    await act(async () => { await current.disconnectVPN(); });
    expect(native.disconnect).not.toHaveBeenCalled();
    await act(async () => { pending.resolve(); await first; });
    await act(async () => { await current.disconnectVPN(); });
    expect(native.disconnect).toHaveBeenCalledTimes(1);
  });

  test('blocks duplicate disconnects and connects during a disconnect', async () => {
    const pending = deferred();
    native.disconnect.mockReturnValue(pending.promise);
    let first, second, connect;
    act(() => {
      first = current.disconnectVPN(); second = current.disconnectVPN(); connect = current.connectVPN(config);
    });
    expect(native.disconnect).toHaveBeenCalledTimes(1);
    expect(native.connect).not.toHaveBeenCalled();
    await act(async () => { pending.resolve(); await Promise.all([first, second, connect]); });
    expect(current.isDisconnecting).toBe(false);
  });

  test('keeps ownership until the post-connect status refresh finishes', async () => {
    const pending = deferred();
    native.getStatus.mockReturnValueOnce(pending.promise);
    let first;
    await act(async () => { first = current.connectVPN(config); await Promise.resolve(); });
    await act(async () => { await current.disconnectVPN(); });
    expect(native.disconnect).not.toHaveBeenCalled();
    await act(async () => { pending.resolve({ isConnected: true }); await first; });
    expect(current.vpnStatus.isConnected).toBe(true);
  });

  test('releases ownership after a rejected native operation', async () => {
    native.connect.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { await current.connectVPN(config); });
    expect(current.isConnecting).toBe(false);
    await act(async () => { await current.disconnectVPN(); });
    expect(native.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe('VPNProvider status result ordering', () => {
  let renderer, current;
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    native.getStatus.mockResolvedValue({ isConnected: false });
    function Consumer() { current = useVPN(); return null; }
    await act(async () => { renderer = create(React.createElement(VPNProvider, null, React.createElement(Consumer))); });
  });
  afterEach(() => { if (renderer) act(() => renderer.unmount()); jest.restoreAllMocks(); });

  test('keeps the newest status when refreshes complete out of order', async () => {
    const old = deferred(), latest = deferred();
    native.getStatus.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    let first, second;
    act(() => { first = current.updateStatus(); second = current.updateStatus(); });
    await act(async () => { latest.resolve({ isConnected: true }); await second; });
    await act(async () => { old.resolve({ isConnected: false }); await first; });
    expect(current.vpnStatus.isConnected).toBe(true);
  });

  test('does not accept an old success after the latest refresh fails', async () => {
    const old = deferred(), latest = deferred();
    native.getStatus.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    let first, second;
    act(() => { first = current.updateStatus(); second = current.updateStatus(); });
    await act(async () => { latest.reject(new Error('current failure')); await second; });
    await act(async () => { old.resolve({ isConnected: true }); await first; });
    expect(current.vpnStatus.isConnected).toBe(false);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  test('does not let a pre-connect refresh overwrite the connected status', async () => {
    const old = deferred(); native.getStatus.mockReturnValueOnce(old.promise);
    let first;
    act(() => { first = current.updateStatus(); });
    native.getStatus.mockResolvedValueOnce({ isConnected: true });
    await act(async () => { await current.connectVPN(config); });
    await act(async () => { old.resolve({ isConnected: false }); await first; });
    expect(current.vpnStatus.isConnected).toBe(true);
  });

  test('ignores failures after unmount', async () => {
    const old = deferred(); native.getStatus.mockReturnValueOnce(old.promise);
    let pending;
    act(() => { pending = current.updateStatus(); renderer.unmount(); });
    renderer = null;
    await act(async () => { old.reject(new Error('obsolete')); await pending; });
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('VPNProvider unmount lifecycle', () => {
  let renderer, current;
  const { Alert } = require('react-native');
  const mount = async () => {
    function Consumer() { current = useVPN(); return null; }
    await act(async () => { renderer = create(React.createElement(VPNProvider, null, React.createElement(Consumer))); });
  };
  const unmount = () => { act(() => renderer.unmount()); renderer = null; };
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    native.getStatus.mockResolvedValue({ isConnected: false });
  });
  afterEach(() => { if (renderer) unmount(); jest.restoreAllMocks(); });

  test('does not start native changes through retained callbacks after unmount', async () => {
    await mount();
    const saved = current;
    unmount();
    await saved.connectVPN(config);
    await saved.disconnectVPN();
    await saved.updateStatus();
    expect(native.connect).not.toHaveBeenCalled();
    expect(native.disconnect).not.toHaveBeenCalled();
    expect(native.getStatus).toHaveBeenCalledTimes(1);
  });

  test('ignores initialization failures after unmount', async () => {
    const pending = deferred(); native.initialize.mockReturnValue(pending.promise);
    await mount();
    unmount();
    await act(async () => { pending.reject(new Error('obsolete initialization')); await Promise.resolve(); });
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test('does not refresh status when initialization finishes after unmount', async () => {
    const pending = deferred(); native.initialize.mockReturnValue(pending.promise);
    await mount();
    unmount();
    await act(async () => { pending.resolve(); await Promise.resolve(); });
    expect(native.getStatus).not.toHaveBeenCalled();
  });

  test.each(['connect', 'disconnect'])('ignores a late %s failure after unmount', async operation => {
    await mount();
    const pending = deferred(); native[operation].mockReturnValue(pending.promise);
    let request;
    act(() => { request = operation === 'connect' ? current.connectVPN(config) : current.disconnectVPN(); });
    unmount();
    await act(async () => { pending.reject(new Error('obsolete operation')); await request; });
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test('still reports a native failure while mounted and admits subsequent work', async () => {
    await mount();
    native.connect.mockRejectedValueOnce(new Error('connection failed'));
    await act(async () => { await current.connectVPN(config); });
    expect(Alert.alert).toHaveBeenCalledWith('Connection Failed', 'connection failed');
    expect(current.isConnecting).toBe(false);
    await act(async () => { await current.disconnectVPN(); });
    expect(native.disconnect).toHaveBeenCalledTimes(1);
  });
});


describe('VPNProvider configuration boundary', () => {
  let renderer, current;
  const { Alert } = require('react-native');
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    native.getStatus.mockResolvedValue({ isConnected: false });
    function Consumer() { current = useVPN(); return null; }
    await act(async () => { renderer = create(React.createElement(VPNProvider, null, React.createElement(Consumer))); });
  });
  afterEach(() => { act(() => renderer.unmount()); jest.restoreAllMocks(); });

  test.each([
    null, undefined, [],
    { ...config, privateKey: 42 }, { ...config, publicKey: '  ' },
    { ...config, serverAddress: '' }, { ...config, serverAddress: {} },
    { ...config, serverPort: 0 }, { ...config, serverPort: 65536 },
    { ...config, serverPort: 1.5 }, { ...config, serverPort: '51820' },
    { ...config, serverPort: NaN }, { ...config, serverPort: Infinity },
    { ...config, allowedIPs: [] }, { ...config, allowedIPs: '0.0.0.0/0' },
    { ...config, allowedIPs: ['0.0.0.0/0', null] },
    { ...config, dns: [42] }, { ...config, dns: '1.1.1.1' },
    { ...config, mtu: 1279 }, { ...config, mtu: 65536 }, { ...config, mtu: 1280.5 },
    { ...config, presharedKey: 42 },
  ])('rejects malformed configuration %p before native work', async invalid => {
    await act(async () => { await current.connectVPN(invalid); });
    expect(native.connect).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Connection Failed', expect.any(String));
    expect(current.isConnecting).toBe(false);
    await act(async () => { await current.connectVPN(config); });
    expect(native.connect).toHaveBeenCalledTimes(1);
  });

  test.each([1, 65535])('passes a valid port boundary %p unchanged', async port => {
    const valid = { ...config, serverPort: port, dns: [], mtu: 1280, presharedKey: '' };
    await act(async () => { await current.connectVPN(valid); });
    expect(native.connect).toHaveBeenCalledWith(valid);
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
