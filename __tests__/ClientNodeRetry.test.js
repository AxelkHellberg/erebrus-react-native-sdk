const React = require('react');
const { act, create } = require('react-test-renderer');

jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity',
  TextInput: 'TextInput', ActivityIndicator: 'ActivityIndicator', ScrollView: 'ScrollView',
  Modal: ({ visible, children }) => visible ? children : null,
  FlatList: ({ data, renderItem }) => React.createElement(React.Fragment, null,
    ...data.map(item => React.createElement(React.Fragment, { key: item.id }, renderItem({ item })))),
  Alert: { alert: jest.fn() },
  StyleSheet: { create: styles => styles },
}), { virtual: true });
jest.mock('react-native-get-random-values', () => ({}));
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('curve25519-js', () => ({ generateKeyPair: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn() }));

const axios = require('axios');
const nodes = [{ id: 'node-sg', name: 'Singapore One', region: 'SG', status: 'active', chainName: 'test' }];
const successfulResponse = () => ({ status: 200, data: { payload: nodes } });
const textContent = value => Array.isArray(value) ? value.map(textContent).join('') : String(value);

describe.each([
  ['source', require('../src/components/ClientCreator').ClientCreator],
  ['compiled package', require('../dist/components/ClientCreator').ClientCreator],
])('ClientCreator node lookup retry (%s)', (_name, ClientCreator) => {
  let renderer;
  const apiConfig = { token: 'fixture-token', gatewayUrl: 'https://example.invalid/' };
  const buttons = text => renderer.root.findAllByType('TouchableOpacity').filter(target =>
    target.findAllByType('Text').some(child => textContent(child.props.children) === text));
  const button = text => buttons(text)[0];
  const errorMessages = () => renderer.root.findAllByType('Text').filter(target =>
    target.props.children === 'Failed to fetch available nodes');
  const render = async () => {
    await act(async () => { renderer = create(React.createElement(ClientCreator, {
      apiConfig, onClientCreated: jest.fn(),
    })); });
  };
  beforeEach(() => {
    axios.get.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    renderer = undefined;
    jest.restoreAllMocks();
  });

  test.each([
    ['network rejection', () => axios.get.mockRejectedValueOnce(new Error('offline'))],
    ['HTTP failure', () => axios.get.mockResolvedValueOnce({ status: 503 })],
  ])('recovers from %s with an explicit retry and usable node selection', async (_case, fail) => {
    fail();
    axios.get.mockResolvedValueOnce(successfulResponse());
    await render();
    expect(errorMessages()).toHaveLength(1);
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(button('Retry').props.accessibilityRole).toBe('button');
    expect(button('Retry').props.accessibilityLabel).toBe('Retry loading nodes');
    await act(async () => { await button('Retry').props.onPress(); });
    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(axios.get.mock.calls[1][0]).toBe('https://example.invalid/api/v1.0/nodes/all');
    expect(axios.get.mock.calls[1][1].headers.Authorization).toBe('Bearer fixture-token');
    expect(errorMessages()).toHaveLength(0);
    expect(buttons('Retry')).toHaveLength(0);
    act(() => button('Singapore').props.onPress());
    expect(button('Select Node').props.disabled).toBe(false);
    act(() => button('Select Node').props.onPress());
    expect(buttons('Singapore One (test)')).toHaveLength(1);
  });

  test('keeps repeated failures available for manual retry without retrying automatically', async () => {
    axios.get.mockRejectedValue(new Error('offline'));
    await render();
    await act(async () => { await Promise.resolve(); });
    expect(axios.get).toHaveBeenCalledTimes(1);
    await act(async () => { await button('Retry').props.onPress(); });
    expect(errorMessages()).toHaveLength(1);
    expect(buttons('Retry')).toHaveLength(1);
    await act(async () => { await Promise.resolve(); });
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test('clears the error and hides Retry for the entire pending lookup', async () => {
    let resolveLookup;
    axios.get.mockRejectedValueOnce(new Error('offline'))
      .mockReturnValueOnce(new Promise(resolve => { resolveLookup = resolve; }));
    await render();
    let retry;
    act(() => { retry = button('Retry').props.onPress(); });
    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(errorMessages()).toHaveLength(0);
    expect(buttons('Retry')).toHaveLength(0);
    expect(renderer.root.findAllByType('ActivityIndicator')).toHaveLength(1);
    await act(async () => { resolveLookup(successfulResponse()); await retry; });
    expect(renderer.root.findAllByType('ActivityIndicator')).toHaveLength(0);
    expect(buttons('Retry')).toHaveLength(0);
  });

  test('offers no retry after a successful initial lookup', async () => {
    axios.get.mockResolvedValueOnce(successfulResponse());
    await render();
    expect(errorMessages()).toHaveLength(0);
    expect(buttons('Retry')).toHaveLength(0);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});
