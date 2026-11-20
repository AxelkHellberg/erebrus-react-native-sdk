const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/components/Auth.tsx'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } },
).outputText;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function response(body) {
  return { ok: true, json: jest.fn().mockResolvedValue(body) };
}

function renderAuth({ fetch, AbortController: Controller = AbortController }) {
  const state = [];
  let index = 0;
  const onTokenReceived = jest.fn();
  const React = {
    useState(initial) {
      const slot = index++;
      if (!(slot in state)) state[slot] = initial;
      return [state[slot], value => { state[slot] = value; }];
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
    return context.exports.Auth({ onTokenReceived });
  };
  return {
    press: () => render().children[0].props.onPress(),
    disabled: () => render().children[0].props.disabled,
    state, onTokenReceived,
  };
}

async function flush() {
  for (let count = 0; count < 12; count++) await Promise.resolve();
}

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

test.each(['organization request', 'organization body', 'token request', 'token body'])(
  'bounds a stalled %s and ignores its late result', async boundary => {
    const pending = deferred();
    const organization = response({ api_key: 'test-api-key' });
    const token = response({ payload: { token: 'test-token' } });
    if (boundary === 'organization body') organization.json.mockReturnValue(pending.promise);
    if (boundary === 'token body') token.json.mockReturnValue(pending.promise);
    const fetch = jest.fn()
      .mockImplementationOnce(() => boundary === 'organization request' ? pending.promise : Promise.resolve(organization))
      .mockImplementationOnce(() => boundary === 'token request' ? pending.promise : Promise.resolve(token));
    const auth = renderAuth({ fetch });
    const attempt = auth.press();
    await flush();
    expect(auth.disabled()).toBe(true);

    await jest.advanceTimersByTimeAsync(30000);
    await flush();
    expect(auth.disabled()).toBe(false);
    expect(auth.state[1]).toBe('error');
    expect(auth.state[2]).toMatch(/timed out/i);
    expect(auth.state[2]).toMatch(/may have completed/i);
    expect(auth.onTokenReceived).not.toHaveBeenCalled();
    expect(fetch.mock.calls.every(([, options]) => options.signal.aborted)).toBe(true);
    expect(jest.getTimerCount()).toBe(0);

    const callsAtTimeout = fetch.mock.calls.length;
    const late = boundary === 'organization request' ? organization
      : boundary === 'organization body' ? { api_key: 'late-api-key' }
      : boundary === 'token request' ? token : { payload: { token: 'late-token' } };
    pending.resolve(late);
    await attempt;
    await flush();
    expect(fetch).toHaveBeenCalledTimes(callsAtTimeout);
    expect(auth.onTokenReceived).not.toHaveBeenCalled();
    expect(auth.state[1]).toBe('error');
    expect(auth.state[2]).toMatch(/timed out/i);
    await jest.advanceTimersByTimeAsync(60000);
    expect(fetch).toHaveBeenCalledTimes(callsAtTimeout);
  },
);

test('uses one deadline across the organization and token stages', async () => {
  const organizationRequest = deferred();
  const tokenRequest = deferred();
  const fetch = jest.fn().mockReturnValueOnce(organizationRequest.promise).mockReturnValueOnce(tokenRequest.promise);
  const auth = renderAuth({ fetch });
  const attempt = auth.press();
  await jest.advanceTimersByTimeAsync(20000);
  organizationRequest.resolve(response({ api_key: 'test-api-key' }));
  await flush();
  expect(fetch).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(10000);
  await flush();
  expect(auth.disabled()).toBe(false);
  expect(auth.state[2]).toMatch(/timed out/i);
  tokenRequest.resolve(response({ payload: { token: 'late-token' } }));
  await attempt;
  expect(auth.onTokenReceived).not.toHaveBeenCalled();
});

test('delivers a successful token before the deadline and clears the timer', async () => {
  const fetch = jest.fn()
    .mockResolvedValueOnce(response({ api_key: 'test-api-key' }))
    .mockResolvedValueOnce(response({ payload: { token: 'test-token' } }));
  const auth = renderAuth({ fetch });
  await auth.press();
  expect(auth.onTokenReceived).toHaveBeenCalledWith('test-token');
  expect(auth.state[1]).toBe('success');
  expect(auth.disabled()).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(false);
  await jest.advanceTimersByTimeAsync(60000);
  expect(auth.state[1]).toBe('success');
  expect(fetch).toHaveBeenCalledTimes(2);
});

test('clears the deadline after an early request failure', async () => {
  const fetch = jest.fn().mockRejectedValue(new Error('offline fixture'));
  const auth = renderAuth({ fetch });
  await auth.press();
  expect(auth.disabled()).toBe(false);
  expect(auth.state[2]).toBe('offline fixture');
  expect(jest.getTimerCount()).toBe(0);
  await jest.advanceTimersByTimeAsync(60000);
  expect(auth.state[2]).toBe('offline fixture');
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('still bounds the wait when AbortController is unavailable', async () => {
  const pending = deferred();
  const fetch = jest.fn().mockReturnValue(pending.promise);
  const auth = renderAuth({ fetch, AbortController: null });
  const attempt = auth.press();
  await jest.advanceTimersByTimeAsync(30000);
  await flush();
  expect(auth.disabled()).toBe(false);
  expect(auth.state[2]).toMatch(/timed out/i);
  expect(fetch).toHaveBeenCalledTimes(1);
  pending.resolve(response({ api_key: 'late-api-key' }));
  await attempt;
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(auth.onTokenReceived).not.toHaveBeenCalled();
});

test('a late rejection cannot replace a later successful manual attempt', async () => {
  const pending = deferred();
  const fetch = jest.fn().mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(response({ api_key: 'test-api-key' }))
    .mockResolvedValueOnce(response({ payload: { token: 'test-token' } }));
  const auth = renderAuth({ fetch });
  const firstAttempt = auth.press();
  await jest.advanceTimersByTimeAsync(30000);
  await firstAttempt;
  expect(fetch).toHaveBeenCalledTimes(1);
  await auth.press();
  expect(auth.onTokenReceived).toHaveBeenCalledTimes(1);
  expect(auth.onTokenReceived).toHaveBeenCalledWith('test-token');
  pending.reject(new Error('late network rejection'));
  await flush();
  expect(auth.state[1]).toBe('success');
  expect(auth.disabled()).toBe(false);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(jest.getTimerCount()).toBe(0);
});
