const React = require('react');
const { act, create } = require('react-test-renderer');

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: styles => styles },
  TouchableOpacity: 'TouchableOpacity',
  TextInput: 'TextInput',
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert: jest.fn() },
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  Modal: 'Modal',
}), { virtual: true });
jest.mock('react-native-get-random-values', () => ({}));
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('curve25519-js', () => ({ generateKeyPair: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn() }));

const axios = require('axios');

const node = (id, region, status = 'active') => ({
  id, region, status, name: id, chainName: 'fixture', walletAddress: 'fixture',
});

describe.each([
  ['source', require('../src/components/ClientCreator').ClientCreator],
  ['compiled', require('../dist/components/ClientCreator').ClientCreator],
])('%s ClientCreator region selection', (_, ClientCreator) => {
  let renderer;

  beforeEach(() => {
    axios.get.mockReset();
  });

  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    renderer = undefined;
  });

  const mount = async nodes => {
    axios.get.mockResolvedValue({ status: 200, data: { payload: nodes } });
    await act(async () => {
      renderer = create(React.createElement(ClientCreator, {
        apiConfig: { token: 'fixture-token', gatewayUrl: 'https://example.invalid/' },
        onClientCreated: jest.fn(),
      }));
    });
  };

  const regionButtons = () => renderer.root.findAllByType('ScrollView')
    .find(scroll => scroll.props.horizontal).findAllByType('TouchableOpacity');

  const labels = () => regionButtons().map(button => button.findByType('Text').props.children);

  const selectRegion = label => {
    const button = regionButtons().find(choice => choice.findByType('Text').props.children === label);
    expect(button).toBeDefined();
    act(() => button.props.onPress());
    return renderer.root.findByType('FlatList');
  };

  test('keeps an existing known-region node selectable', async () => {
    await mount([node('singapore', 'SG')]);
    expect(labels()).toContain('Singapore');
    expect(selectRegion('Singapore').props.data.map(item => item.id)).toEqual(['singapore']);
  });

  test('clears the selected node when switching regions', async () => {
    await mount([node('us', 'US'), node('de', 'DE')]);
    act(() => renderer.root.findByType('TextInput').props.onChangeText('client'));
    const list = selectRegion('United States');
    act(() => list.props.renderItem({ item: list.props.data[0] }).props.onPress());
    selectRegion('Germany');
    const createButton = renderer.root.findAllByType('TouchableOpacity')
      .find(button => button.findAllByType('Text').some(text => text.props.children === 'Create Client'));
    expect(createButton.props.disabled).toBe(true);
  });

  test('makes an active node outside the original country list selectable', async () => {
    await mount([node('amsterdam', 'NL')]);
    expect(labels()).toEqual(['NL']);
    const list = selectRegion('NL');
    expect(list.props.data.map(item => item.id)).toEqual(['amsterdam']);
    const chooser = renderer.root.findAllByType('TouchableOpacity')
      .find(button => button.findAllByType('Text').some(text => text.props.children === 'Select Node'));
    expect(chooser.props.disabled).toBe(false);
    act(() => renderer.root.findByType('TextInput').props.onChangeText('client'));
    act(() => list.props.renderItem({ item: list.props.data[0] }).props.onPress());
    const createButton = renderer.root.findAllByType('TouchableOpacity')
      .find(button => button.findAllByType('Text').some(text => text.props.children === 'Create Client'));
    expect(createButton.props.disabled).toBe(false);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test('retains known display names and one option per available region', async () => {
    await mount([node('us-east', 'US'), node('us-west', 'US'), node('de', 'DE')]);
    expect(labels()).toEqual(['United States', 'Germany']);
    expect(selectRegion('United States').props.data.map(item => item.id)).toEqual(['us-east', 'us-west']);
    expect(selectRegion('Germany').props.data.map(item => item.id)).toEqual(['de']);
  });

  test('matches case and whitespace variations consistently', async () => {
    await mount([node('us-east', ' us '), node('us-west', 'US'), node('nl-one', 'nl'), node('nl-two', ' NL ')]);
    expect(labels()).toEqual(['United States', 'NL']);
    expect(selectRegion('United States').props.data.map(item => item.id)).toEqual(['us-east', 'us-west']);
    expect(selectRegion('NL').props.data.map(item => item.id)).toEqual(['nl-one', 'nl-two']);
  });

  test('excludes regions with no eligible nodes', async () => {
    await mount([node('active', 'NL'), node('offline', 'SG', 'inactive'), node('blank', ' ')]);
    expect(labels()).toEqual(['NL']);
  });

  test('renders no region options when the gateway has no active nodes', async () => {
    await mount([]);
    expect(labels()).toEqual([]);
    expect(renderer.root.findByType('FlatList').props.data).toEqual([]);
  });
});
