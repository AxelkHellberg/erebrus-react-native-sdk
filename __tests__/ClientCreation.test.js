const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', TextInput: 'TextInput',
  ActivityIndicator: 'ActivityIndicator', ScrollView: 'ScrollView', FlatList: 'FlatList', Modal: 'Modal',
  StyleSheet: { create: value => value }, Alert: { alert: jest.fn() },
}), { virtual: true });
jest.mock('react-native-get-random-values', () => ({}), { virtual: true });
jest.mock('react-native-qrcode-svg', () => 'QRCode', { virtual: true });
jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('curve25519-js', () => ({ generateKeyPair: () => ({ private: new Uint8Array(32), public: new Uint8Array(32) }) }));
jest.mock('../src/components/Auth', () => ({ Auth: 'Auth' }));
const axios = require('axios');
const { Alert } = require('react-native');
const { ClientCreator } = require('../src/components/ClientCreator');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const result = () => ({ status: 200, json: async () => ({ payload: { client: { Address: ['10.0.0.2/32'], PresharedKey: 'psk' }, serverPublicKey: 'server', endpoint: 'vpn.test' } }) });

describe('ClientCreator creation ownership', () => {
  let renderer, onClientCreated, originalFetch;
  const button = () => renderer.root.findAllByType('TouchableOpacity').find(b => b.findAllByType('Text').some(t => t.props.children === 'Create Client'));
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    originalFetch = global.fetch;
    global.fetch = jest.fn();
    onClientCreated = jest.fn();
    const node = { id: 'node', name: 'Node', region: 'US', status: 'active', chainName: 'test' };
    axios.get.mockResolvedValue({ status: 200, data: { payload: [node] } });
    await act(async () => { renderer = create(React.createElement(ClientCreator, { apiConfig: { token: 'test', gatewayUrl: 'https://gateway.test/' }, onClientCreated })); });
    act(() => {
      renderer.root.findByType('TextInput').props.onChangeText('client');
      renderer.root.findAllByType('TouchableOpacity').find(b => b.findAllByType('Text').some(t => t.props.children === 'United States')).props.onPress();
    });
    act(() => { const list = renderer.root.findByType('FlatList'); list.props.renderItem({ item: node }).props.onPress(); });
  });
  afterEach(() => { act(() => renderer.unmount()); global.fetch = originalFetch; jest.restoreAllMocks(); });

  test('admits a single POST for two taps before React commits', async () => {
    const pending = deferred(); global.fetch.mockReturnValue(pending.promise);
    const press = button().props.onPress;
    let first, second;
    act(() => { first = press(); second = press(); });
    const calls = global.fetch.mock.calls.length;
    await act(async () => { pending.resolve(result()); await Promise.all([first, second]); });
    expect(calls).toBe(1);
    expect(onClientCreated).toHaveBeenCalledTimes(1);
  });

  test('keeps ownership while the response body is pending', async () => {
    const body = deferred(); global.fetch.mockResolvedValue({ status: 200, json: () => body.promise });
    let first;
    await act(async () => { first = button().props.onPress(); await Promise.resolve(); });
    // Keep the original callback to simulate a delayed native tap dispatch.
    const press = global.fetch.mock.calls.length && renderer.root.findAllByType('TouchableOpacity').find(b => b.props.disabled === true && b.findAllByType('ActivityIndicator').length).props.onPress;
    let second;
    act(() => { second = press(); });
    const calls = global.fetch.mock.calls.length;
    await act(async () => { body.resolve((await result().json())); await Promise.all([first, second]); });
    expect(calls).toBe(1);
  });

  test.each(['network', 'http', 'body'])('permits a new attempt after %s failure', async kind => {
    if (kind === 'network') global.fetch.mockRejectedValueOnce(new Error('offline'));
    if (kind === 'http') global.fetch.mockResolvedValueOnce({ status: 503, text: async () => 'unavailable' });
    if (kind === 'body') global.fetch.mockResolvedValueOnce({ status: 200, json: async () => { throw new Error('invalid body'); } });
    await act(async () => { await button().props.onPress(); });
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    global.fetch.mockResolvedValueOnce(result());
    await act(async () => { await button().props.onPress(); });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(onClientCreated).toHaveBeenCalledTimes(1);
  });
});
