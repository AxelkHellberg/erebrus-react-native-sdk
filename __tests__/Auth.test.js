const React = require('react');
const { act, create } = require('react-test-renderer');

jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', ActivityIndicator: 'ActivityIndicator',
  TextInput: 'TextInput', ScrollView: 'ScrollView', FlatList: 'FlatList', Modal: 'Modal', Alert: { alert: jest.fn() },
  StyleSheet: { create: value => value },
}), { virtual: true });
jest.mock('react-native-get-random-values', () => ({}), { virtual: true });
jest.mock('react-native-qrcode-svg', () => 'QRCode', { virtual: true });
jest.mock('axios', () => ({ get: jest.fn() }));

const { Auth } = require('../src/components/Auth');
const { ClientCreator } = require('../src/components/ClientCreator');
const org = () => ({ ok: true, json: async () => ({ api_key: 'test-api-key' }) });
const token = () => ({ ok: true, json: async () => ({ payload: { token: 'test-token' } }) });

describe('Auth gateway ownership', () => {
  let renderer, onTokenReceived;
  const originalFetch = global.fetch;
  const render = gatewayUrl => React.createElement(Auth, { gatewayUrl, onTokenReceived });
  const press = () => renderer.root.findByType('TouchableOpacity').props.onPress();

  beforeEach(() => {
    onTokenReceived = jest.fn();
    global.fetch = jest.fn().mockResolvedValueOnce(org()).mockResolvedValueOnce(token());
  });
  afterEach(() => { if (renderer) act(() => renderer.unmount()); global.fetch = originalFetch; });

  test.each(['https://custom.test/base', 'https://custom.test/base/'])('uses %s for both authentication steps', async gateway => {
    await act(async () => { renderer = create(render(gateway)); });
    await act(async () => { await press(); });
    expect(global.fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://custom.test/base/api/v1.1/organisation',
      'https://custom.test/base/api/v1.1/organisation/token',
    ]);
    expect(global.fetch.mock.calls[1][1].headers['X-ORG-API-KEY']).toBe('test-api-key');
    expect(onTokenReceived).toHaveBeenCalledWith('test-token');
  });

  test('preserves the documented default gateway', async () => {
    await act(async () => { renderer = create(render(undefined)); });
    await act(async () => { await press(); });
    expect(global.fetch.mock.calls[0][0]).toBe('https://gateway.dev.netsepio.com/api/v1.1/organisation');
    expect(onTokenReceived).toHaveBeenCalledWith('test-token');
  });

  test('does not continue an organization request after the gateway changes', async () => {
    let resolve;
    global.fetch.mockReset().mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
    await act(async () => { renderer = create(render('https://old.test/')); });
    let pending;
    act(() => { pending = press(); });
    await act(async () => { renderer.update(render('https://new.test/')); });
    await act(async () => { resolve(org()); await pending; });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(onTokenReceived).not.toHaveBeenCalled();
    expect(renderer.root.findByType('TouchableOpacity').props.disabled).toBe(false);
  });

  test('does not deliver a token after unmount', async () => {
    let resolve;
    global.fetch.mockReset().mockResolvedValueOnce(org()).mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
    await act(async () => { renderer = create(render('https://one.test/')); });
    let pending;
    await act(async () => { pending = press(); await Promise.resolve(); });
    act(() => renderer.unmount());
    renderer = null;
    await act(async () => { resolve(token()); await pending; });
    expect(onTokenReceived).not.toHaveBeenCalled();
  });

  test('forwards the ClientCreator gateway to embedded authentication', async () => {
    require('axios').get.mockResolvedValue({ status: 200, data: { payload: [] } });
    await act(async () => {
      renderer = create(React.createElement(ClientCreator, {
        apiConfig: { token: '', gatewayUrl: 'https://embedded.test/' }, onClientCreated: jest.fn(),
      }));
    });
    await act(async () => { await press(); });
    expect(global.fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://embedded.test/api/v1.1/organisation', 'https://embedded.test/api/v1.1/organisation/token',
    ]);
  });
});
