const React = require('react');
const { act, create } = require('react-test-renderer');

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: styles => styles },
  Animated: {
    View: 'AnimatedView',
    Value: class Value { constructor(value) { this.value = value; } },
    timing: jest.fn(),
    sequence: () => ({ start: jest.fn() }),
  },
}), { virtual: true });

describe.each([
  ['source', require('../src/components/ConnectionButton').ConnectionButton],
  ['compiled package', require('../dist/components/ConnectionButton').ConnectionButton],
])('ConnectionButton accessibility (%s)', (_name, ConnectionButton) => {
  let renderer;
  afterEach(() => { if (renderer) act(() => renderer.unmount()); });

  test.each([
    [false, 'Connect', 'onConnect', 'onDisconnect'],
    [true, 'Disconnect', 'onDisconnect', 'onConnect'],
  ])('names the idle action when connected=%s', (isConnected, label, action, otherAction) => {
    const props = { isConnected, isConnecting: false, isDisconnecting: false,
      onConnect: jest.fn(), onDisconnect: jest.fn() };
    act(() => { renderer = create(React.createElement(ConnectionButton, props)); });
    const button = renderer.root.findByType('TouchableOpacity');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe(label);
    expect(button.props.accessibilityState).toEqual({ disabled: false, busy: false });
    expect(button.props.disabled).toBe(false);
    act(() => button.props.onPress());
    expect(props[action]).toHaveBeenCalledTimes(1);
    expect(props[otherAction]).not.toHaveBeenCalled();
  });

  test('keeps the action named and exposes busy state through connection transitions', () => {
    const props = { isConnected: false, isConnecting: false, isDisconnecting: false,
      onConnect: jest.fn(), onDisconnect: jest.fn() };
    act(() => { renderer = create(React.createElement(ConnectionButton, props)); });
    const update = changes => act(() => {
      Object.assign(props, changes);
      renderer.update(React.createElement(ConnectionButton, props));
    });
    const expectState = (label, busy) => {
      const button = renderer.root.findByType('TouchableOpacity');
      expect(button.props.accessibilityRole).toBe('button');
      expect(button.props.accessibilityLabel).toBe(label);
      expect(button.props.accessibilityState).toEqual({ disabled: busy, busy });
      expect(button.props.disabled).toBe(busy);
      expect(renderer.root.findAllByType('ActivityIndicator')).toHaveLength(busy ? 1 : 0);
      if (busy) expect(button.findAllByType('Text')).toHaveLength(0);
    };

    update({ isConnecting: true });
    expectState('Connect', true);
    update({ isConnected: true, isConnecting: false });
    expectState('Disconnect', false);
    update({ isDisconnecting: true });
    expectState('Disconnect', true);
    update({ isConnected: false, isDisconnecting: false });
    expectState('Connect', false);
    expect(props.onConnect).not.toHaveBeenCalled();
    expect(props.onDisconnect).not.toHaveBeenCalled();
  });
});
