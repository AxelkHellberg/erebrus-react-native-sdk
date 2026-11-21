const React = require('react');
const { act, create } = require('react-test-renderer');

jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: styles => styles },
}), { virtual: true });

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const response = (body, ok = true) => ({ ok, json: async () => body });

describe.each([
  ['source', require('../src/components/Auth').Auth],
  ['compiled package', require('../dist/components/Auth').Auth],
])('Auth accessibility (%s)', (_name, Auth) => {
  const originalFetch = global.fetch;
  let renderer;
  let onTokenReceived;
  const button = () => renderer.root.findByType('TouchableOpacity');
  const expectButton = busy => {
    expect(button().props.accessibilityRole).toBe('button');
    expect(button().props.accessibilityLabel).toBe('Create Organization & Get Token');
    expect(button().props.accessibilityState).toEqual({ disabled: busy, busy });
    expect(button().props.disabled).toBe(busy);
  };
  const render = () => act(() => {
    renderer = create(React.createElement(Auth, { onTokenReceived }));
  });
  beforeEach(() => {
    onTokenReceived = jest.fn();
    global.fetch = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    renderer = undefined;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('keeps the action named while both authentication stages are pending', async () => {
    const organization = deferred();
    const token = deferred();
    global.fetch.mockReturnValueOnce(organization.promise).mockReturnValueOnce(token.promise);
    render();
    expectButton(false);
    let attempt;
    act(() => { attempt = button().props.onPress(); });
    expectButton(true);
    expect(button().findAllByType('Text')).toHaveLength(0);
    expect(button().findAllByType('ActivityIndicator')).toHaveLength(1);
    await act(async () => { organization.resolve(response({ api_key: 'fixture-api-key' })); });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expectButton(true);
    await act(async () => {
      token.resolve(response({ payload: { token: 'fixture-token' } }));
      await attempt;
    });
    expectButton(false);
    expect(onTokenReceived).toHaveBeenCalledWith('fixture-token');
    const result = renderer.root.findAllByType('Text').find(text => text.props.children === 'Token generated!');
    expect(result.props.accessibilityLiveRegion).toBe('polite');
  });

  test.each([
    ['organization response', () => global.fetch.mockResolvedValueOnce(response({ message: 'Organization unavailable' }, false)), 'Organization unavailable'],
    ['token response', () => global.fetch.mockResolvedValueOnce(response({ api_key: 'fixture-api-key' }))
      .mockResolvedValueOnce(response({ message: 'Token unavailable' }, false)), 'Token unavailable'],
    ['request rejection', () => global.fetch.mockRejectedValueOnce(new Error('Request unavailable')), 'Request unavailable'],
  ])('announces %s failures and clears the previous result on a manual retry', async (_case, setup, message) => {
    setup();
    render();
    await act(async () => { await button().props.onPress(); });
    expectButton(false);
    expect(onTokenReceived).not.toHaveBeenCalled();
    const result = renderer.root.findAllByType('Text').find(text => text.props.children === message);
    expect(result.props.accessibilityRole).toBe('alert');
    expect(result.props.accessibilityLiveRegion).toBe('assertive');
    const retry = deferred();
    global.fetch.mockReturnValueOnce(retry.promise)
      .mockResolvedValueOnce(response({ payload: { token: 'retry-token' } }));
    let attempt;
    act(() => { attempt = button().props.onPress(); });
    expectButton(true);
    expect(renderer.root.findAllByType('Text').some(text => text.props.children === message)).toBe(false);
    await act(async () => {
      retry.resolve(response({ api_key: 'retry-api-key' }));
      await attempt;
    });
    expectButton(false);
    expect(onTokenReceived).toHaveBeenCalledTimes(1);
    expect(onTokenReceived).toHaveBeenCalledWith('retry-token');
  });
});
