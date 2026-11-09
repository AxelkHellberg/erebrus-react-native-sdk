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

  test.each([null, [], {}, 'connected', { isConnected: 'false' },
    { isConnected: 1 }, { isConnected: true, tunnelState: {} },
    { isConnected: false, error: { message: 'offline' } },
    { isConnected: false, vpnPermissionGranted: 'yes' },
  ])('rejects malformed native status %j without replacing the last valid status', async status => {
    native.getStatus.mockResolvedValueOnce(status);
    await act(async () => { await current.updateStatus(); });
    expect(current.vpnStatus).toEqual({ isConnected: false });
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  test.each(['UP', 'CONNECTED', 'INACTIVE'])('retains native platform tunnel state %s', async tunnelState => {
    const status = { isConnected: true, tunnelState, error: '', vpnPermissionGranted: true };
    native.getStatus.mockResolvedValueOnce(status);
    await act(async () => { await current.updateStatus(); });
    expect(current.vpnStatus).toEqual(status);
    expect(console.error).not.toHaveBeenCalled();
  });

  test('accepts Android ERROR statuses with a null exception message', async () => {
    native.getStatus.mockResolvedValueOnce({ isConnected: false, tunnelState: 'ERROR', error: null });
    await act(async () => { await current.updateStatus(); });
    expect(current.vpnStatus).toEqual({ isConnected: false, tunnelState: 'ERROR' });
    expect(console.error).not.toHaveBeenCalled();
  });

  test('a malformed newest status cannot admit an older response', async () => {
    const old = deferred();
    native.getStatus.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ isConnected: 'false' });
    let pending;
    act(() => { pending = current.updateStatus(); });
    await act(async () => { await current.updateStatus(); });
    await act(async () => { old.resolve({ isConnected: true }); await pending; });
    expect(current.vpnStatus).toEqual({ isConnected: false });
  });

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
