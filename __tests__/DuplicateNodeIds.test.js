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

const axios = require('axios');
const node = (id, region = 'US') => ({ id, name: id, region, status: 'active', chainName: 'test' });
const implementations = [
  ['source', require('../src/components/ClientCreator').ClientCreator],
  ['compiled', require('../dist/components/ClientCreator').ClientCreator],
];

describe.each(implementations)('%s ClientCreator node identity', (_, ClientCreator) => {
  let renderer;
  const list = () => renderer.root.findByType('FlatList');
  const buttonWithText = label => renderer.root.findAllByType('TouchableOpacity').find(button =>
    button.findAllByType('Text').some(text => text.props.children === label));
  const selectRegion = label => act(() => buttonWithText(label).props.onPress());
  const renderNodes = async payload => {
    axios.get.mockResolvedValueOnce({ status: 200, data: { payload } });
    await act(async () => {
      renderer = create(React.createElement(ClientCreator, {
        apiConfig: { token: 'test-token', gatewayUrl: 'https://gateway.test/' },
        onClientCreated: jest.fn(),
      }));
    });
    selectRegion('United States');
  };

  beforeEach(() => { jest.resetAllMocks(); });
  afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null; });

  test.each([2, 3])('excludes all %i records sharing an active ID', async copies => {
    await renderNodes([node('first'), ...Array.from({ length: copies }, () => node('repeated')), node('last')]);
    expect(list().props.data.map(item => item.id)).toEqual(['first', 'last']);
    expect(list().props.data.map(list().props.keyExtractor)).toEqual(['first', 'last']);
  });

  test('excludes a repeated ID from every region instead of selecting an arbitrary record', async () => {
    await renderNodes([node('shared'), node('us-only'), node('shared', 'SG'), node('sg-only', 'SG')]);
    expect(list().props.data.map(item => item.id)).toEqual(['us-only']);
    selectRegion('Singapore');
    expect(list().props.data.map(item => item.id)).toEqual(['sg-only']);
  });

  test('disables the node chooser and creation when every active ID is repeated', async () => {
    await renderNodes([node('repeated'), node('repeated')]);
    expect(list().props.data).toEqual([]);
    expect(buttonWithText('Select Node').props.disabled).toBe(true);
    expect(buttonWithText('Create Client').props.disabled).toBe(true);
  });

  test('preserves the order, data and selectable identity of unique active nodes', async () => {
    const records = [node('third'), node('first'), node('second')];
    await renderNodes(records);
    expect(list().props.data).toEqual(records);
    expect(buttonWithText('Select Node').props.disabled).toBe(false);
    act(() => { list().props.renderItem({ item: records[1] }).props.onPress(); });
    expect(buttonWithText('first (test)')).toBeDefined();
  });

  test('compares opaque IDs exactly without trimming or folding case', async () => {
    const records = [node('opaque'), node('Opaque'), node(' opaque ')];
    await renderNodes(records);
    expect(list().props.data).toEqual(records);
  });

  test('does not let an unusable or inactive record remove a unique active node', async () => {
    const usable = node('usable');
    await renderNodes([
      usable,
      { ...usable, status: 'inactive' },
      { ...usable, region: 42 },
      { ...usable, name: {} },
    ]);
    expect(list().props.data).toEqual([usable]);
    expect(buttonWithText('Select Node').props.disabled).toBe(false);
  });
});
