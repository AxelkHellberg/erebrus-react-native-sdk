const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function response(body) {
  return { ok: true, json: jest.fn().mockResolvedValue(body) };
}

function renderAuth(entry, fetch, Controller = AbortController) {
  const file = fs.readFileSync(path.join(__dirname, '..', entry), 'utf8');
  const source = ts.transpileModule(file, {
    fileName: 'Auth.tsx',
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true,
      jsxFactory: entry.startsWith('dist/') ? 'react_1.default.createElement' : 'React.createElement',
    },
  }).outputText;
  const slots = [];
  const effects = [];
  const pendingEffects = [];
  let index = 0;
  let mounted = true;
  let updatesAfterUnmount = 0;
  const onTokenReceived = jest.fn();
  const React = {
    useState(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = initial;
      return [slots[slot], value => {
        if (!mounted) updatesAfterUnmount++;
        slots[slot] = value;
      }];
    },
    useRef(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = { current: initial };
      return slots[slot];
    },
    useEffect(effect) {
      const slot = index++;
      if (!(slot in effects)) {
        effects[slot] = { effect };
        pendingEffects.push(() => { effects[slot].cleanup = effect(); });
      }
    },
    createElement(type, props, ...children) { return { type, props: props || {}, children }; },
  };
  const native = {
    View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity',
    ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value },
  };
  const context = {
    exports: {}, fetch, AbortController: Controller, setTimeout, clearTimeout,
    console: { error: jest.fn() },
    require(name) {
      if (name === 'react') return React;
      if (name === 'react-native') return native;
      throw new Error(`Unexpected module: ${name}`);
    },
  };
  vm.runInNewContext(source, context);
  const render = () => {
    index = 0;
    const tree = context.exports.Auth({ onTokenReceived });
    while (pendingEffects.length) pendingEffects.shift()();
    return tree;
  };
  const press = render().children[0].props.onPress;
  return {
    press,
    onTokenReceived,
    errors: context.console.error,
    updatesAfterUnmount: () => updatesAfterUnmount,
    unmount() {
      mounted = false;
      effects.forEach(({ cleanup }) => cleanup?.());
    },
    restartEffects() {
      effects.forEach(record => {
        record.cleanup?.();
        record.cleanup = record.effect();
      });
    },
  };
}

async function flush() {
  for (let count = 0; count < 24; count++) await Promise.resolve();
}

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

describe.each(['src/components/Auth.tsx', 'dist/components/Auth.js'])('%s', entry => {
  test.each(['organization request', 'organization body', 'token request', 'token body'])(
    'cancels the pending %s on unmount and ignores its late result', async boundary => {
      const pending = deferred();
      const organization = response({ api_key: 'fixture-key' });
      const token = response({ payload: { token: 'fixture-token' } });
      if (boundary === 'organization body') organization.json.mockReturnValue(pending.promise);
      if (boundary === 'token body') token.json.mockReturnValue(pending.promise);
      const fetch = jest.fn()
        .mockImplementationOnce(() => boundary === 'organization request' ? pending.promise : Promise.resolve(organization))
        .mockImplementationOnce(() => boundary === 'token request' ? pending.promise : Promise.resolve(token));
      const auth = renderAuth(entry, fetch);
      const attempt = auth.press();
      let settled = false;
      attempt.then(() => { settled = true; });
      await flush();
      const callsBeforeUnmount = fetch.mock.calls.length;
      auth.unmount();
      await flush();
      expect(jest.getTimerCount()).toBe(0);
      expect(settled).toBe(true);
      expect(fetch.mock.calls.every(([, options]) => options.signal.aborted)).toBe(true);

      const late = boundary === 'organization request' ? organization
        : boundary === 'organization body' ? { api_key: 'late-key' }
        : boundary === 'token request' ? token : { payload: { token: 'late-token' } };
      pending.resolve(late);
      await attempt;
      await flush();
      expect(fetch).toHaveBeenCalledTimes(callsBeforeUnmount);
      expect(auth.onTokenReceived).not.toHaveBeenCalled();
      expect(auth.errors).not.toHaveBeenCalled();
      expect(auth.updatesAfterUnmount()).toBe(0);
    },
  );

  test('discards a late rejection without AbortController support', async () => {
    const pending = deferred();
    const fetch = jest.fn().mockReturnValue(pending.promise);
    const auth = renderAuth(entry, fetch, null);
    const attempt = auth.press();
    auth.unmount();
    await flush();
    expect(jest.getTimerCount()).toBe(0);
    pending.reject(new Error('late fixture failure'));
    await attempt;
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(auth.onTokenReceived).not.toHaveBeenCalled();
    expect(auth.errors).not.toHaveBeenCalled();
    expect(auth.updatesAfterUnmount()).toBe(0);
  });

  test.each(['organization request', 'organization body', 'token request', 'token body'])(
    'checks cancellation when a resolved %s continuation races with cleanup', async boundary => {
      // Sweep the scheduling gap both before and after a nested async helper returns.
      for (const microtasks of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
        const pending = deferred();
        const organization = response({ api_key: 'fixture-key' });
        const token = response({ payload: { token: 'fixture-token' } });
        if (boundary === 'organization body') organization.json.mockReturnValue(pending.promise);
        if (boundary === 'token body') token.json.mockReturnValue(pending.promise);
        const fetch = jest.fn()
          .mockImplementationOnce(() => boundary === 'organization request' ? pending.promise : Promise.resolve(organization))
          .mockImplementationOnce(() => boundary === 'token request' ? pending.promise : Promise.resolve(token));
        const auth = renderAuth(entry, fetch);
        const attempt = auth.press();
        await flush();
        const result = boundary === 'organization request' ? organization
          : boundary === 'organization body' ? { api_key: 'fixture-key' }
          : boundary === 'token request' ? token : { payload: { token: 'fixture-token' } };
        pending.resolve(result);
        for (let count = 0; count < microtasks; count++) await Promise.resolve();
        const callsBeforeUnmount = fetch.mock.calls.length;
        const bodiesBeforeUnmount = organization.json.mock.calls.length + token.json.mock.calls.length;
        const callbacksBeforeUnmount = auth.onTokenReceived.mock.calls.length;
        auth.unmount();
        await attempt;
        await flush();
        expect(fetch).toHaveBeenCalledTimes(callsBeforeUnmount);
        expect(organization.json.mock.calls.length + token.json.mock.calls.length).toBe(bodiesBeforeUnmount);
        expect(auth.onTokenReceived).toHaveBeenCalledTimes(callbacksBeforeUnmount);
        expect(auth.errors).not.toHaveBeenCalled();
        expect(auth.updatesAfterUnmount()).toBe(0);
        expect(jest.getTimerCount()).toBe(0);
      }
    },
  );

  test('keeps an obsolete attempt cancelled after an effect restart', async () => {
    const pending = deferred();
    const fetch = jest.fn().mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(response({ api_key: 'current-key' }))
      .mockResolvedValueOnce(response({ payload: { token: 'current-token' } }));
    const auth = renderAuth(entry, fetch);
    const firstAttempt = auth.press();
    auth.restartEffects();
    await flush();
    pending.resolve(response({ api_key: 'obsolete-key' }));
    await firstAttempt;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(auth.onTokenReceived).not.toHaveBeenCalled();
    await auth.press();
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(auth.onTokenReceived).toHaveBeenCalledTimes(1);
    expect(auth.onTokenReceived).toHaveBeenCalledWith('current-token');
    expect(jest.getTimerCount()).toBe(0);
  });

  test('ignores a retained press handler after unmount', async () => {
    const fetch = jest.fn();
    const auth = renderAuth(entry, fetch);
    auth.unmount();
    await auth.press();
    expect(fetch).not.toHaveBeenCalled();
    expect(auth.updatesAfterUnmount()).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });
});
