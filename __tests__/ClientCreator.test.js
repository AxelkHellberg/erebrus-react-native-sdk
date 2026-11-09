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
jest.mock('../src/components/Auth', () => ({ Auth: 'Auth' }));

const axios = require('axios');
const { ClientCreator } = require('../src/components/ClientCreator');
const node = id => ({ id, name: id, region: 'US', status: 'active', chainName: 'test' });
const response = id => ({ status: 200, data: { payload: [node(id)] } });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

describe('ClientCreator node request ownership', () => {
  let renderer;
  const render = apiConfig => React.createElement(ClientCreator, { apiConfig, onClientCreated: jest.fn() });
  const nodes = () => renderer.root.findByType('FlatList').props.data.map(n => n.id);
  const selectUS = () => {
    const region = renderer.root.findAllByType('TouchableOpacity').find(button =>
      button.findAllByType('Text').some(text => text.props.children === 'United States'));
    act(() => region.props.onPress());
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    axios.get.mockResolvedValue(response('initial'));
  });
  afterEach(() => { if (renderer) act(() => renderer.unmount()); jest.restoreAllMocks(); });

  test('does not refetch when the caller recreates an equivalent apiConfig', async () => {
    await act(async () => { renderer = create(render({ token: 'first', gatewayUrl: 'https://one.test/' })); });
    await act(async () => { renderer.update(render({ token: 'first', gatewayUrl: 'https://one.test/' })); });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test('uses a replacement token and ignores a late response from the old token', async () => {
    const old = deferred();
    axios.get.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response('new'));
    await act(async () => { renderer = create(render({ token: 'old', gatewayUrl: 'https://one.test/' })); });
    await act(async () => { renderer.update(render({ token: 'new', gatewayUrl: 'https://one.test/' })); });
    expect(axios.get.mock.calls[1][1].headers.Authorization).toBe('Bearer new');
    selectUS();
    expect(nodes()).toEqual(['new']);
    await act(async () => { old.resolve(response('old')); });
    expect(nodes()).toEqual(['new']);
  });

  test('does not let an obsolete request failure hide a successful new response', async () => {
    const old = deferred();
    axios.get.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response('new'));
    await act(async () => { renderer = create(render({ token: 'token', gatewayUrl: 'https://one.test/' })); });
    await act(async () => { renderer.update(render({ token: 'token', gatewayUrl: 'https://two.test/' })); });
    await act(async () => { old.reject(new Error('old endpoint unavailable')); });
    selectUS();
    expect(nodes()).toEqual(['new']);
    expect(console.error).not.toHaveBeenCalled();
  });

  test('clears authenticated nodes and selection when the caller removes the token', async () => {
    await act(async () => { renderer = create(render({ token: 'token', gatewayUrl: 'https://one.test/' })); });
    selectUS();
    expect(nodes()).toEqual(['initial']);
    await act(async () => { renderer.update(render({ token: '', gatewayUrl: 'https://one.test/' })); });
    expect(renderer.root.findAllByType('Auth')).toHaveLength(1);
    expect(renderer.root.findAllByType('FlatList')).toHaveLength(0);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test('pairs simultaneous gateway and token changes without sending the old token to the new gateway', async () => {
    await act(async () => { renderer = create(render({ token: 'old', gatewayUrl: 'https://one.test/' })); });
    await act(async () => { renderer.update(render({ token: 'new', gatewayUrl: 'https://two.test/' })); });
    expect(axios.get.mock.calls.map(([url, options]) => [url, options.headers.Authorization])).toEqual([
      ['https://one.test/api/v1.0/nodes/all', 'Bearer old'],
      ['https://two.test/api/v1.0/nodes/all', 'Bearer new'],
    ]);
  });

  test('retains the locally authenticated token when the caller still has no token', async () => {
    await act(async () => { renderer = create(render({ token: '', gatewayUrl: 'https://one.test/' })); });
    await act(async () => { renderer.root.findByType('Auth').props.onTokenReceived('local'); });
    await act(async () => { renderer.update(render({ token: '', gatewayUrl: 'https://one.test/' })); });
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][1].headers.Authorization).toBe('Bearer local');
  });

  test('keeps the new request loading when the obsolete request completes first', async () => {
    const old = deferred(), latest = deferred();
    axios.get.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    await act(async () => { renderer = create(render({ token: 'token', gatewayUrl: 'https://one.test/' })); });
    await act(async () => { renderer.update(render({ token: 'token', gatewayUrl: 'https://two.test/' })); });
    await act(async () => { old.resolve(response('old')); });
    expect(renderer.root.findAllByType('ActivityIndicator')).toHaveLength(1);
    await act(async () => { latest.resolve(response('latest')); });
    selectUS();
    expect(nodes()).toEqual(['latest']);
  });

  test('ignores a request failure after unmount', async () => {
    const pending = deferred();
    axios.get.mockReturnValueOnce(pending.promise);
    await act(async () => { renderer = create(render({ token: 'token', gatewayUrl: 'https://one.test/' })); });
    act(() => renderer.unmount());
    renderer = null;
    await act(async () => { pending.reject(new Error('obsolete')); });
    expect(console.error).not.toHaveBeenCalled();
  });
  test.each([null, { region: 42 }, { id: 42 }, { id: '' }, { name: {} }, { chainName: [] }])('keeps valid nodes beside malformed record %j', async malformed => {
    axios.get.mockResolvedValueOnce({ status: 200, data: { payload: [node('valid'), malformed === null ? null : { ...node('bad'), ...malformed }] } });
    await act(async () => { renderer = create(render({ token: 'token', gatewayUrl: 'https://one.test/' })); });
    selectUS();
    expect(nodes()).toEqual(['valid']);
    const list = renderer.root.findByType('FlatList');
    expect(list.props.keyExtractor(list.props.data[0])).toBe('valid');
    expect(() => create(list.props.renderItem({ item: list.props.data[0] }))).not.toThrow();
  });

  test.each([null, {}, 'invalid'])('reports invalid node list envelope %j', async payload => {
    axios.get.mockResolvedValueOnce({ status: 200, data: { payload } });
    await act(async () => { renderer = create(render({ token: 'token', gatewayUrl: 'https://one.test/' })); });
    expect(renderer.root.findAllByType('Text').some(t => t.props.children === 'Failed to fetch available nodes')).toBe(true);
    expect(renderer.root.findAllByType('ActivityIndicator')).toHaveLength(0);
  });

  test('keeps empty lists and optional node display fields compatible', async () => {
    axios.get.mockResolvedValueOnce({ status: 200, data: { payload: [{ id: 'minimal', status: 'active', region: 'US' }, { ...node('inactive'), status: 'inactive' }] } });
    await act(async () => { renderer = create(render({ token: 'token', gatewayUrl: 'https://one.test/' })); });
    selectUS();
    expect(nodes()).toEqual(['minimal']);
    axios.get.mockResolvedValueOnce({ status: 200, data: { payload: [] } });
    await act(async () => { renderer.update(render({ token: 'next', gatewayUrl: 'https://one.test/' })); });
    expect(nodes()).toEqual([]);
  });

});
