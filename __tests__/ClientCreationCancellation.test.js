const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
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
jest.mock('curve25519-js', () => ({ generateKeyPair: () => ({ private: new Uint8Array(32), public: new Uint8Array(32) }) }));
jest.mock('../src/components/Auth', () => ({ Auth: 'Auth' }));
jest.mock('../dist/components/Auth', () => ({ Auth: 'Auth' }));
const axios = require('axios');
const { Alert } = require('react-native');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const payload = () => ({ payload: { client: { Address: ['10.0.0.2/32'], PresharedKey: 'psk' }, serverPublicKey: 'server', endpoint: 'vpn.test' } });
const response = () => ({ status: 200, json: jest.fn().mockResolvedValue(payload()) });
const flush = async () => { for (let count = 0; count < 12; count++) await Promise.resolve(); };

describe.each(['../src/components/ClientCreator', '../dist/components/ClientCreator'])('%s cancellation', entry => {
  const loadComponent = () => {
    if (entry.startsWith('../src/')) return require(entry).ClientCreator;
    const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, entry + '.js'), 'utf8'), {
      fileName: 'ClientCreator.tsx',
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, jsxFactory: 'react_1.default.createElement' },
    }).outputText;
    const context = {
      exports: {}, global, console, React, crypto: global.crypto,
      require: name => name === './Auth' ? { Auth: 'Auth' } : require(name),
      fetch: (...args) => global.fetch(...args),
      get AbortController() { return global.AbortController; },
      setTimeout: (...args) => setTimeout(...args),
      clearTimeout: timer => clearTimeout(timer),
    };
    vm.runInNewContext(source, context);
    return context.exports.ClientCreator;
  };
  const ClientCreator = loadComponent();
  let renderer, onClientCreated, originalFetch, originalAbortController, lifecycle;
  const node = { id: 'node', name: 'Node', region: 'US', status: 'active', chainName: 'test' };
  const props = (token = 'test', gatewayUrl = 'https://gateway.test/') => ({ apiConfig: { token, gatewayUrl }, onClientCreated });
  const button = () => renderer.root.findAllByType('TouchableOpacity').find(b => b.findAllByType('Text').some(t => t.props.children === 'Create Client'));
  const selectNode = () => {
    act(() => {
      renderer.root.findByType('TextInput').props.onChangeText('client');
      renderer.root.findAllByType('TouchableOpacity').find(b => b.findAllByType('Text').some(t => t.props.children === 'United States')).props.onPress();
    });
    act(() => renderer.root.findByType('FlatList').props.renderItem({ item: node }).props.onPress());
  };
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    originalFetch = global.fetch;
    originalAbortController = global.AbortController;
    global.fetch = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    onClientCreated = jest.fn();
    axios.get.mockResolvedValue({ status: 200, data: { payload: [node] } });
    // Retain the real lifecycle effect so its cleanup/setup cycle can be replayed.
    lifecycle = null;
    const useEffect = React.useEffect;
    jest.spyOn(React, 'useEffect').mockImplementation((setup, dependencies) => {
      if (!lifecycle) {
        lifecycle = { setup };
        return useEffect(() => {
          lifecycle.cleanup = setup();
          return () => lifecycle.cleanup?.();
        }, dependencies);
      }
      return useEffect(setup, dependencies);
    });
    await act(async () => { renderer = create(React.createElement(ClientCreator, props())); });
    selectNode();
  });
  afterEach(async () => {
    if (renderer) await act(async () => { renderer.unmount(); await flush(); });
    renderer = null;
    global.fetch = originalFetch;
    global.AbortController = originalAbortController;
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  const start = async phase => {
    const pending = deferred();
    const reply = phase === 'text' ? { status: 503, text: jest.fn().mockReturnValue(pending.promise) }
      : { status: 200, json: jest.fn().mockReturnValue(pending.promise) };
    global.fetch.mockReturnValueOnce(phase === 'headers' ? pending.promise : Promise.resolve(reply));
    let request, settled = false;
    await act(async () => { request = button().props.onPress(); request.then(() => { settled = true; }); await flush(); });
    return { pending, reply, request, settled: () => settled };
  };
  const change = async kind => {
    await act(async () => {
      if (kind === 'unmount') { renderer.unmount(); renderer = null; }
      else renderer.update(React.createElement(ClientCreator, props(kind === 'token' ? 'replacement' : 'test', kind === 'gateway' ? 'https://other.test/' : 'https://gateway.test/')));
      await flush();
    });
  };

  describe.each(['unmount', 'token', 'gateway'])('%s', kind => {
    test.each(['headers', 'json', 'text'])('cancels pending %s without waiting for its response or timeout', async phase => {
      const attempt = await start(phase);
      await change(kind);
      expect(attempt.settled()).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
      expect(global.fetch.mock.calls[0][1].signal.aborted).toBe(true);
      await act(async () => {
        attempt.pending.resolve(phase === 'headers' ? response() : phase === 'json' ? payload() : 'late failure');
        await attempt.request;
        await flush();
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(onClientCreated).not.toHaveBeenCalled();
      expect(Alert.alert).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
      if (renderer) expect(renderer.root.findAllByType('QRCode')).toHaveLength(0);
    });
  });

  test('settles cancellation without AbortController and consumes a late rejection', async () => {
    global.AbortController = undefined;
    const attempt = await start('headers');
    await change('unmount');
    expect(attempt.settled()).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    expect(global.fetch.mock.calls[0][1].signal).toBeUndefined();
    attempt.pending.reject(new Error('late network failure'));
    await attempt.request;
    await flush();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test.each(['token', 'gateway'])('ignores retained handlers from the previous %s after cancellation settles', async kind => {
    const press = button().props.onPress;
    const attempt = await start('headers');
    await change(kind);
    expect(attempt.settled()).toBe(true);
    await act(async () => { await press(); });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    // Current authentication can still admit a new manual attempt.
    selectNode();
    global.fetch.mockResolvedValueOnce(response());
    await act(async () => { await button().props.onPress(); });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[1][0]).toMatch(kind === 'gateway' ? /^https:\/\/other.test\// : /^https:\/\/gateway.test\//);
    expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe(kind === 'token' ? 'Bearer replacement' : 'Bearer test');
    expect(onClientCreated).toHaveBeenCalledTimes(1);
    attempt.pending.resolve(response());
    await attempt.request;
    await flush();
    expect(onClientCreated).toHaveBeenCalledTimes(1);
  });

  test('keeps an old attempt cancelled after lifecycle cleanup/setup and preserves a newer attempt', async () => {
    const first = await start('headers');
    await act(async () => { lifecycle.cleanup(); lifecycle.cleanup = lifecycle.setup(); await flush(); });
    expect(first.settled()).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    const second = await start('headers');
    await act(async () => { first.pending.resolve(response()); await first.request; await flush(); });
    expect(second.settled()).toBe(false);
    expect(jest.getTimerCount()).toBe(1);
    expect(onClientCreated).not.toHaveBeenCalled();
    await act(async () => { second.pending.resolve(response()); await second.request; });
    expect(onClientCreated).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  test.each(['headers', 'json', 'text'])('checks cancellation immediately after resolved %s waits race with cleanup', async phase => {
    // Exercise both sides of Promise.race's continuation scheduling gap.
    for (const turns of [0, 1, 2]) {
      const attempt = await start(phase);
      const reply = response();
      attempt.pending.resolve(phase === 'headers' ? reply : phase === 'json' ? payload() : 'late failure');
      for (let count = 0; count < turns; count++) await Promise.resolve();
      const bodies = reply.json.mock.calls.length;
      const callbacks = onClientCreated.mock.calls.length;
      const alerts = Alert.alert.mock.calls.length;
      act(() => { lifecycle.cleanup(); lifecycle.cleanup = lifecycle.setup(); });
      await act(async () => { await attempt.request; await flush(); });
      expect(reply.json).toHaveBeenCalledTimes(bodies);
      expect(onClientCreated).toHaveBeenCalledTimes(callbacks);
      expect(Alert.alert).toHaveBeenCalledTimes(alerts);
      expect(jest.getTimerCount()).toBe(0);
    }
  });
});
