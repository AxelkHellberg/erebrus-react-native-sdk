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
jest.mock('curve25519-js', () => ({ generateKeyPair: () => ({
  private: new Uint8Array(32), public: new Uint8Array(32),
}) }));
jest.mock('axios', () => ({ get: jest.fn() }));

const axios = require('axios');
const { Alert } = require('react-native');
const gatewayUrl = 'https://gateway.example.invalid/';
const clientPath = '/api/v1.0/erebrus/client/';

describe.each([
  ['source', require('../src/components/ClientCreator').ClientCreator],
  ['compiled package', require('../dist/components/ClientCreator').ClientCreator],
])('ClientCreator node paths (%s)', (_name, ClientCreator) => {
  let renderer;
  const originalFetch = global.fetch;
  const textContent = value => Array.isArray(value) ? value.map(textContent).join('') : String(value);
  const button = text => renderer.root.findAllByType('TouchableOpacity').find(target =>
    target.findAllByType('Text').some(child => textContent(child.props.children) === text));
  const press = text => act(() => button(text).props.onPress());

  beforeEach(() => {
    axios.get.mockReset();
    Alert.alert.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(global.crypto, 'getRandomValues').mockImplementation(array => array.fill(0));
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ payload: {
        client: { Address: ['10.0.0.2/32'], PresharedKey: 'fixture-preshared-key' },
        serverPublicKey: 'fixture-public-key', endpoint: 'vpn.example.invalid',
      } }),
    });
  });

  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    renderer = undefined;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test.each([
    ['ordinary UUID', '5f168771-f555-4b24-9f6f-62f049419060', '5f168771-f555-4b24-9f6f-62f049419060'],
    ['path separators', 'node/one', 'node%2Fone'],
    ['query and fragment delimiters', 'node?zone=SG#primary', 'node%3Fzone%3DSG%23primary'],
    ['literal percent encoding', 'node%2Fone', 'node%252Fone'],
    ['spaces', 'node one', 'node%20one'],
    ['Unicode', 'node-東京', 'node-%E6%9D%B1%E4%BA%AC'],
  ])('preserves %s as one selected node identifier', async (_case, nodeId, encodedId) => {
    const onClientCreated = jest.fn();
    axios.get.mockResolvedValue({ status: 200, data: { payload: [{
      id: nodeId, name: 'Fixture Node', region: 'SG', status: 'active', chainName: 'test',
    }] } });
    await act(async () => {
      renderer = create(React.createElement(ClientCreator, {
        apiConfig: { token: 'fixture-token', gatewayUrl }, onClientCreated,
      }));
    });
    act(() => renderer.root.findByType('TextInput').props.onChangeText('client'));
    press('Singapore');
    press('Select Node');
    press('Fixture Node (test)');
    expect(button('Create Client').props.disabled).toBe(false);
    await act(async () => { await button('Create Client').props.onPress(); });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [requestUrl, request] = global.fetch.mock.calls[0];
    expect(requestUrl).toBe(`${gatewayUrl}api/v1.0/erebrus/client/${encodedId}`);
    const parsed = new URL(requestUrl);
    expect(parsed.pathname).toBe(clientPath + encodedId);
    expect(parsed.search).toBe('');
    expect(parsed.hash).toBe('');
    expect(decodeURIComponent(parsed.pathname.slice(clientPath.length))).toBe(nodeId);
    expect(request.method).toBe('POST');
    expect(JSON.parse(request.body).name).toBe('client');
    expect(onClientCreated).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
