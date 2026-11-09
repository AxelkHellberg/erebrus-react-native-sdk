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

  test('admits one organization POST for two taps before React commits', async () => {
    let resolve;
    global.fetch.mockReset().mockReturnValueOnce(new Promise(yes => { resolve = yes; })).mockResolvedValueOnce(token());
    await act(async () => { renderer = create(render('https://one.test/')); });
    const savedPress = renderer.root.findByType('TouchableOpacity').props.onPress;
    let first, second;
    act(() => { first = savedPress(); second = savedPress(); });
    const calls = global.fetch.mock.calls.length;
    await act(async () => { resolve(org()); await Promise.all([first, second]); });
    expect(calls).toBe(1);
    expect(onTokenReceived).toHaveBeenCalledTimes(1);
  });

  test.each(['organization', 'organization body', 'token body'])('keeps a single authentication flow during %s', async phase => {
    let resolve;
    const pending = new Promise(yes => { resolve = yes; });
    global.fetch.mockReset();
    if (phase === 'organization') global.fetch.mockReturnValueOnce(pending).mockResolvedValueOnce(token());
    if (phase === 'organization body') global.fetch.mockResolvedValueOnce({ ok: true, json: () => pending }).mockResolvedValueOnce(token());
    if (phase === 'token body') global.fetch.mockResolvedValueOnce(org()).mockResolvedValueOnce({ ok: true, json: () => pending });
    await act(async () => { renderer = create(render('https://one.test/')); });
    const savedPress = renderer.root.findByType('TouchableOpacity').props.onPress;
    let first, second;
    await act(async () => { first = savedPress(); await Promise.resolve(); });
    const callsBefore = global.fetch.mock.calls.length;
    act(() => { second = savedPress(); });
    const callsAfter = global.fetch.mock.calls.length;
    await act(async () => {
      resolve(phase === 'organization' ? org() : phase === 'organization body' ? { api_key: 'test-api-key' } : { payload: { token: 'test-token' } });
      await Promise.all([first, second]);
    });
    expect(callsAfter).toBe(callsBefore);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(onTokenReceived).toHaveBeenCalledTimes(1);
  });

  test.each(['network', 'http', 'body'])('releases single-flight ownership after %s failure', async phase => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch.mockReset();
    if (phase === 'network') global.fetch.mockRejectedValueOnce(new Error('offline'));
    if (phase === 'http') global.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'unavailable' }) });
    if (phase === 'body') global.fetch.mockResolvedValueOnce({ ok: true, json: async () => { throw new Error('invalid JSON'); } });
    await act(async () => { renderer = create(render('https://one.test/')); });
    await act(async () => { await press(); });
    global.fetch.mockResolvedValueOnce(org()).mockResolvedValueOnce(token());
    await act(async () => { await press(); });
    expect(onTokenReceived).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByType('TouchableOpacity').props.disabled).toBe(false);
    jest.restoreAllMocks();
  });

  test('does not create another organization while an old gateway request settles', async () => {
    let resolve;
    global.fetch.mockReset().mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
    await act(async () => { renderer = create(render('https://old.test/')); });
    let pending;
    act(() => { pending = press(); });
    await act(async () => { renderer.update(render('https://new.test/')); });
    act(() => { void press(); });
    const calls = global.fetch.mock.calls.length;
    await act(async () => { resolve(org()); await pending; });
    expect(calls).toBe(1);
    expect(onTokenReceived).not.toHaveBeenCalled();
    global.fetch.mockResolvedValueOnce(org()).mockResolvedValueOnce(token());
    await act(async () => { await press(); });
    expect(global.fetch.mock.calls[1][0]).toBe('https://new.test/api/v1.1/organisation');
    expect(onTokenReceived).toHaveBeenCalledTimes(1);
  });
  test.each([{}, [], 42, true, '   '])('rejects malformed organization key %j before requesting a token', async value => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch.mockReset().mockResolvedValueOnce({ ok: true, json: async () => ({ api_key: value }) }).mockResolvedValueOnce(token());
    await act(async () => { renderer = create(render('https://one.test/')); });
    await act(async () => { await press(); });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(onTokenReceived).not.toHaveBeenCalled();
    expect(renderer.root.findByType('TouchableOpacity').props.disabled).toBe(false);
    jest.restoreAllMocks();
  });

  test.each([{}, [], 42, true, '   '])('does not deliver malformed token %j', async value => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch.mockReset().mockResolvedValueOnce(org()).mockResolvedValueOnce({ ok: true, json: async () => ({ payload: { token: value } }) });
    await act(async () => { renderer = create(render('https://one.test/')); });
    await act(async () => { await press(); });
    expect(onTokenReceived).not.toHaveBeenCalled();
    expect(renderer.root.findByType('TouchableOpacity').props.disabled).toBe(false);
    jest.restoreAllMocks();
  });

  test.each(['organization', 'token'])('renders a safe fallback for a non-text %s error message', async phase => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const invalid = { ok: false, json: async () => ({ message: { detail: 'unavailable' } }) };
    global.fetch.mockReset();
    if (phase === 'token') global.fetch.mockResolvedValueOnce(org());
    global.fetch.mockResolvedValueOnce(invalid);
    await act(async () => { renderer = create(render('https://one.test/')); });
    await act(async () => { await press(); });
    const texts = renderer.root.findAllByType('Text').map(t => t.props.children);
    expect(texts).toContain(phase === 'organization' ? 'Failed to create organization' : 'Failed to generate token');
    expect(onTokenReceived).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  test('accepts the legacy Token field and preserves credential bytes', async () => {
    global.fetch.mockReset().mockResolvedValueOnce({ ok: true, json: async () => ({ api_key: ' key ' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ payload: { Token: ' token ' } }) });
    await act(async () => { renderer = create(render('https://one.test/')); });
    await act(async () => { await press(); });
    expect(global.fetch.mock.calls[1][1].headers['X-ORG-API-KEY']).toBe(' key ');
    expect(onTokenReceived).toHaveBeenCalledWith(' token ');
  });

});
