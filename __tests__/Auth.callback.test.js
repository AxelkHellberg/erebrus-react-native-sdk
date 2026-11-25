const React = require('react');
const { act, create } = require('react-test-renderer');

jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: value => value },
}), { virtual: true });

const warning = 'Token generated, but the application callback failed. Check the application before creating another organization.';
const org = () => ({ ok: true, json: async () => ({ api_key: 'test-api-key' }) });
const token = () => ({ ok: true, json: async () => ({ payload: { token: 'private-test-token' } }) });
const deferred = () => {
  let reject;
  const promise = new Promise((_resolve, no) => { reject = no; });
  return { promise, reject };
};

describe.each([
  ['source', require('../src/components/Auth').Auth],
  ['compiled package', require('../dist/components/Auth').Auth],
])('Auth callback failures (%s)', (_name, Auth) => {
  let renderer, onTokenReceived;
  const originalFetch = global.fetch;
  const render = gatewayUrl => React.createElement(Auth, { gatewayUrl, onTokenReceived });
  const messages = () => renderer.root.findAllByType('Text').map(text => text.props.children);
  const press = () => renderer.root.findByType('TouchableOpacity').props.onPress();
  const assertDelivered = () => {
    expect(onTokenReceived).toHaveBeenCalledTimes(1);
    expect(onTokenReceived).toHaveBeenCalledWith('private-test-token');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(renderer.root.findByType('TouchableOpacity').props.disabled).toBe(false);
    expect(messages()).toContain('Token generated!');
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    onTokenReceived = jest.fn();
    global.fetch = jest.fn().mockResolvedValueOnce(org()).mockResolvedValueOnce(token());
  });
  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    renderer = null;
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test.each([
    ['Error', new Error('private-test-token: private application detail')],
    ['structured value', { message: 'private-test-token', detail: 'private application detail' }],
    ['null', null],
  ])('preserves authentication success when the callback throws %s', async (_kind, failure) => {
    onTokenReceived.mockImplementation(() => { throw failure; });
    await act(async () => { renderer = create(render('https://one.test/')); });
    await act(async () => { await expect(press()).resolves.toBeUndefined(); });
    assertDelivered();
    expect(messages()).toContain(warning);
    expect(messages().join(' ')).not.toMatch(/private-test-token|private application detail|Unknown error/);
    expect(console.error).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(onTokenReceived).toHaveBeenCalledTimes(1);
  });

  test('handles a rejected asynchronous callback without an authentication error or resend', async () => {
    onTokenReceived.mockImplementation(() => Promise.reject(new Error('private-test-token')));
    await act(async () => { renderer = create(render('https://one.test/')); });
    await act(async () => { await expect(press()).resolves.toBeUndefined(); });
    assertDelivered();
    expect(messages()).toContain(warning);
    expect(messages().join(' ')).not.toContain('private-test-token');
    expect(console.error).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  test('releases the completed network flow while an application callback remains pending', async () => {
    const pending = deferred();
    onTokenReceived.mockReturnValue(pending.promise);
    await act(async () => { renderer = create(render('https://one.test/')); });
    await act(async () => { await press(); });
    assertDelivered();
    expect(messages()).not.toContain(warning);
    expect(jest.getTimerCount()).toBe(0);
    await act(async () => { pending.reject(new Error('private-test-token')); });
    assertDelivered();
    expect(messages()).toContain(warning);
    expect(console.error).not.toHaveBeenCalled();
  });

  test.each(['unmount', 'gateway change', 'later authentication'])('ignores a late callback rejection after %s', async change => {
    const pending = deferred();
    onTokenReceived.mockReturnValueOnce(pending.promise);
    await act(async () => { renderer = create(render('https://one.test/')); });
    await act(async () => { await press(); });
    if (change === 'unmount') {
      act(() => renderer.unmount());
      renderer = null;
    } else if (change === 'gateway change') {
      await act(async () => { renderer.update(render('https://two.test/')); });
    } else {
      global.fetch.mockResolvedValueOnce(org()).mockResolvedValueOnce(token());
      await act(async () => { await press(); });
    }
    await act(async () => { pending.reject(new Error('private-test-token')); });
    if (renderer) expect(messages()).not.toContain(warning);
    expect(console.error).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(change === 'later authentication' ? 4 : 2);
    expect(jest.getTimerCount()).toBe(0);
  });

  test.each(['gateway change', 'later authentication'])('clears a previous callback warning on %s', async change => {
    onTokenReceived.mockImplementationOnce(() => { throw new Error('callback failed'); });
    await act(async () => { renderer = create(render('https://one.test/')); });
    await act(async () => { await press(); });
    expect(messages()).toContain(warning);
    if (change === 'gateway change') {
      await act(async () => { renderer.update(render('https://two.test/')); });
    } else {
      global.fetch.mockResolvedValueOnce(org()).mockResolvedValueOnce(token());
      await act(async () => { await press(); });
      expect(messages()).toContain('Token generated!');
    }
    expect(messages()).not.toContain(warning);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('preserves single-flight ownership during synchronous callback delivery', async () => {
    let savedPress, reentrant;
    onTokenReceived.mockImplementation(() => { reentrant = savedPress(); });
    await act(async () => { renderer = create(render('https://one.test/')); });
    savedPress = renderer.root.findByType('TouchableOpacity').props.onPress;
    await act(async () => { await savedPress(); await reentrant; });
    assertDelivered();
    expect(messages()).not.toContain(warning);
  });
});
