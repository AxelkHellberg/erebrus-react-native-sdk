const React = require('react');
const { act, create } = require('react-test-renderer');

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: styles => styles },
}), { virtual: true });

describe.each([
  ['source', require('../src/components/StatusCard').StatusCard],
  ['compiled package', require('../dist/components/StatusCard').StatusCard],
])('StatusCard connection state (%s)', (_name, StatusCard) => {
  let renderer;
  afterEach(() => { if (renderer) act(() => renderer.unmount()); });

  const text = value => renderer.root.findAllByType('Text').find(node => node.props.children === value);
  const mount = props => act(() => { renderer = create(React.createElement(StatusCard, props)); });

  test('does not report a disconnected tunnel before any status is available', () => {
    mount({ vpnStatus: null });
    const unknownValues = renderer.root.findAllByType('Text').filter(node => node.props.children === 'Unknown');
    expect(unknownValues).toHaveLength(2); // Connection and State are both unknown.
    expect(unknownValues[0].props.style).toContainEqual({ color: '#6b7280' });
    expect(text('Disconnected')).toBeUndefined();
    expect(text('Connected')).toBeUndefined();
  });

  test.each([
    [true, 'Connected', '#10b981', 'connected'],
    [false, 'Disconnected', '#ef4444', 'disconnected'],
  ])('preserves a reported connection state of %s', (isConnected, label, color, tunnelState) => {
    mount({ vpnStatus: { isConnected, tunnelState } });
    expect(text(label).props.style).toContainEqual({ color });
    expect(text(tunnelState)).toBeDefined();
  });

  test('updates from unknown to reported states and back when the status is cleared', () => {
    mount({ vpnStatus: null });
    for (const [vpnStatus, label] of [
      [{ isConnected: true, tunnelState: 'connected' }, 'Connected'],
      [null, 'Unknown'],
      [{ isConnected: false, tunnelState: 'disconnected', error: 'Tunnel unavailable' }, 'Disconnected'],
    ]) {
      act(() => renderer.update(React.createElement(StatusCard, { vpnStatus })));
      expect(text(label)).toBeDefined();
      if (vpnStatus === null) expect(text('Disconnected')).toBeUndefined();
    }
    expect(text('Tunnel unavailable')).toBeDefined();
  });

  test('uses the supplied neutral theme color for an unavailable status', () => {
    const theme = { surface: '#111111', border: '#222222', text: '#ffffff',
      textSecondary: '#cccccc', success: '#00ff00', error: '#ff0000' };
    mount({ vpnStatus: null, theme });
    const unknownValues = renderer.root.findAllByType('Text').filter(node => node.props.children === 'Unknown');
    expect(unknownValues).toHaveLength(2);
    expect(unknownValues[0].props.style).toContainEqual({ color: theme.textSecondary });
  });
});
