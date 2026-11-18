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
const nodes = [
  { id: 'node-sg-1', name: 'Singapore One', region: 'SG', status: 'active', chainName: 'test' },
  { id: 'node-sg-2', name: 'Singapore Two', region: 'SG', status: 'active', chainName: 'test' },
];

describe.each([
  ['source', require('../src/components/ClientCreator').ClientCreator],
  ['compiled package', require('../dist/components/ClientCreator').ClientCreator],
])('ClientCreator accessibility (%s)', (_name, ClientCreator) => {
  let renderer;
  const originalFetch = global.fetch;
  const textContent = value => Array.isArray(value) ? value.map(textContent).join('') : String(value);
  const button = text => renderer.root.findAllByType('TouchableOpacity').find(target =>
    target.findAllByType('Text').some(child => textContent(child.props.children) === text));
  const press = text => act(() => button(text).props.onPress());
  const render = async () => {
    await act(async () => { renderer = create(React.createElement(ClientCreator, {
      apiConfig: { token: 'test-token', gatewayUrl: 'https://example.invalid/' },
      onClientCreated: jest.fn(),
    })); });
  };
  beforeEach(() => {
    axios.get.mockReset().mockResolvedValue({ status: 200, data: { payload: nodes } });
    Alert.alert.mockClear();
    global.fetch = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    renderer = undefined;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('gives the client name field a persistent accessible label', async () => {
    await render();
    const input = renderer.root.findByType('TextInput');
    expect(input.props.accessibilityLabel).toBe('Client Name');
    act(() => input.props.onChangeText('client'));
    expect(renderer.root.findByType('TextInput').props.accessibilityLabel).toBe('Client Name');
    expect(renderer.root.findByType('TextInput').props.value).toBe('client');
  });

  test('exposes the current region selection as it changes', async () => {
    await render();
    expect(button('Singapore').props.accessibilityRole).toBe('button');
    expect(button('Singapore').props.accessibilityState).toEqual({ selected: false });
    press('Singapore');
    expect(button('Singapore').props.accessibilityState).toEqual({ selected: true });
    press('India');
    expect(button('Singapore').props.accessibilityState).toEqual({ selected: false });
    expect(button('India').props.accessibilityState).toEqual({ selected: true });
  });

  test('exposes whether node selection is available for the current region', async () => {
    await render();
    const expectChooser = disabled => {
      const chooser = button('Select Node');
      expect(chooser.props.accessibilityRole).toBe('button');
      expect(chooser.props.accessibilityLabel).toBe('Select Node');
      expect(chooser.props.accessibilityValue).toEqual({ text: 'No node selected' });
      expect(chooser.props.accessibilityState).toEqual({ disabled, expanded: false });
      expect(chooser.props.disabled).toBe(disabled);
    };
    expectChooser(true);
    press('Singapore');
    expectChooser(false);
    press('India');
    expectChooser(true);
  });

  test('exposes node selection, the selected name and the modal close action', async () => {
    await render();
    press('Singapore');
    press('Select Node');
    expect(button('Select Node').props.accessibilityState.expanded).toBe(true);
    expect(button('Close').props.accessibilityRole).toBe('button');
    expect(button('Close').props.accessibilityLabel).toBe('Close node selection');
    expect(button('Singapore One (test)').props.accessibilityRole).toBe('button');
    expect(button('Singapore One (test)').props.accessibilityState).toEqual({ selected: false });
    press('Singapore One (test)');
    const chooser = button('Singapore One (test)');
    expect(chooser.props.accessibilityLabel).toBe('Select Node');
    expect(chooser.props.accessibilityValue).toEqual({ text: 'Singapore One (test)' });
    expect(chooser.props.accessibilityState.expanded).toBe(false);
    press('Singapore One (test)');
    const choices = renderer.root.findAllByType('TouchableOpacity').filter(target =>
      target.props.accessibilityState && 'selected' in target.props.accessibilityState &&
      target.findAllByType('Text').some(child => textContent(child.props.children) === 'Singapore One (test)'));
    expect(choices).toHaveLength(1);
    expect(choices[0].props.accessibilityState.selected).toBe(true);
    expect(button('Singapore Two (test)').props.accessibilityState).toEqual({ selected: false });
    press('Close');
    expect(button('Singapore One (test)').props.accessibilityState.expanded).toBe(false);
    press('India');
    expect(button('Select Node').props.accessibilityValue).toEqual({ text: 'No node selected' });
  });

  test('keeps the create action named while showing disabled and busy state', async () => {
    await render();
    expect(button('Create Client').props.accessibilityRole).toBe('button');
    expect(button('Create Client').props.accessibilityLabel).toBe('Create Client');
    expect(button('Create Client').props.accessibilityState).toEqual({ disabled: true, busy: false });
    act(() => renderer.root.findByType('TextInput').props.onChangeText('client'));
    press('Singapore');
    press('Select Node');
    press('Singapore One (test)');
    expect(button('Create Client').props.accessibilityState).toEqual({ disabled: false, busy: false });
    let finish;
    global.fetch.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    act(() => { button('Create Client').props.onPress(); });
    const busy = renderer.root.findAllByType('TouchableOpacity').find(target => target.props.accessibilityLabel === 'Create Client');
    expect(busy.props.accessibilityRole).toBe('button');
    expect(busy.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(busy.props.disabled).toBe(true);
    expect(busy.findAllByType('ActivityIndicator')).toHaveLength(1);
    expect(busy.findAllByType('Text')).toHaveLength(0);
    await act(async () => { finish({ status: 400, text: async () => 'Rejected' }); });
    expect(button('Create Client').props.accessibilityState).toEqual({ disabled: false, busy: false });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to create VPN client: Rejected');
  });

  test('names node loading progress and exposes a failed lookup as an alert', async () => {
    let rejectLookup;
    axios.get.mockReturnValue(new Promise((_resolve, reject) => { rejectLookup = reject; }));
    await render();
    const progress = renderer.root.findByType('ActivityIndicator');
    expect(progress.props.accessibilityRole).toBe('progressbar');
    expect(progress.props.accessibilityLabel).toBe('Loading nodes');
    await act(async () => { rejectLookup(new Error('offline')); });
    const error = renderer.root.findAllByType('Text').find(target => target.props.children === 'Failed to fetch available nodes');
    expect(error.props.accessibilityRole).toBe('alert');
    expect(renderer.root.findAllByType('ActivityIndicator')).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
