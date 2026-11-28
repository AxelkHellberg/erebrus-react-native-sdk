const React = require('react');
const { act, create } = require('react-test-renderer');

jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity',
  TextInput: 'TextInput', ActivityIndicator: 'ActivityIndicator',
  ScrollView: 'ScrollView', FlatList: 'FlatList', Modal: 'Modal',
  Alert: { alert: jest.fn() }, StyleSheet: { create: (styles) => styles },
}), { virtual: true });
jest.mock('react-native-get-random-values', () => ({}));
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('axios', () => ({ get: jest.fn(async () => ({ status: 200, data: { payload: [] } })) }));

const style = (node) => Object.assign({}, ...[node.props.style].flat());
const findText = (renderer, text) => renderer.root.findAllByType('Text').find((node) => node.props.children === text);

describe.each(['src', 'dist'])('%s authentication fallback theme', (entry) => {
  const { ClientCreator } = require(`../${entry}/components/ClientCreator`);
  const { Auth } = require(`../${entry}/components/Auth`);
  let renderer;
  let fetchBefore;
  let error;

  beforeEach(() => {
    fetchBefore = global.fetch;
    global.fetch = jest.fn();
    error = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    renderer = undefined;
    global.fetch = fetchBefore;
    error.mockRestore();
  });

  const renderClient = async (theme, token = '') => {
    await act(async () => {
      renderer = create(React.createElement(ClientCreator, {
        apiConfig: { token, gatewayUrl: 'https://gateway.example/' },
        onClientCreated: jest.fn(), theme,
      }));
    });
  };

  test('forwards the success color and renders it in Auth', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ api_key: 'test-key' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ payload: { token: 'test-token' } }) });
    // Capture the actual fallback props, then render Auth with a passive callback.
    // ClientCreator normally removes its fallback when authentication succeeds.
    await act(async () => {
      renderer = create(React.createElement(ClientCreator, {
        apiConfig: { token: '', gatewayUrl: 'https://gateway.example/' },
        onClientCreated: jest.fn(), theme: { success: '#123456' },
      }));
    });
    const fallback = renderer.root.findByType(Auth);
    await act(async () => {
      renderer.update(React.createElement(Auth, {
        ...fallback.props, onTokenReceived: jest.fn(),
      }));
    });
    await act(async () => renderer.root.findByType('TouchableOpacity').props.onPress());
    expect(style(findText(renderer, 'Token generated!')).color).toBe('#123456');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('passes custom error colors to the visible fallback on failure', async () => {
    global.fetch.mockResolvedValue({ ok: false, json: async () => ({ message: 'Unavailable' }) });
    await renderClient({ error: '#654321' });
    await act(async () => renderer.root.findByType('TouchableOpacity').props.onPress());
    expect(style(findText(renderer, 'Unavailable')).color).toBe('#654321');
  });

  test('keeps ClientCreator defaults with a partial theme', async () => {
    await renderClient({ success: '#123456' }, 'test-token');
    expect(style(renderer.root.findAllByType('ScrollView')[0]).backgroundColor).toBe('#f5f5f5');
    expect(style(findText(renderer, 'Create New Client')).color).toBe('#000000');
    expect(renderer.root.findAllByType('ActivityIndicator')).toHaveLength(0);
  });

  test('keeps custom ClientCreator colors while filling omitted colors', async () => {
    await renderClient({ background: '#abcdef', text: '#fedcba' }, 'test-token');
    expect(style(renderer.root.findAllByType('ScrollView')[0]).backgroundColor).toBe('#abcdef');
    expect(style(findText(renderer, 'Create New Client')).color).toBe('#fedcba');
    expect(style(renderer.root.findAllByType('TextInput')[0]).borderColor).toBe('#e5e7eb');
  });

  test('preserves standalone Auth default primary and fallback default primary', async () => {
    await act(async () => {
      renderer = create(React.createElement(Auth, { onTokenReceived: jest.fn() }));
    });
    expect(style(renderer.root.findByType('TouchableOpacity')).backgroundColor).toBe('#007AFF');
    await act(async () => renderer.unmount());
    renderer = undefined;
    await renderClient();
    expect(style(renderer.root.findByType('TouchableOpacity')).backgroundColor).toBe('#6366f1');
  });
});
