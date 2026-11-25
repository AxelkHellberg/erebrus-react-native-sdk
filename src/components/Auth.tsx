import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface AuthProps {
  onTokenReceived: (token: string) => void;
  gatewayUrl?: string;
}

const AUTH_TIMEOUT_MS = 30_000;
const CALLBACK_WARNING = 'Token generated, but the application callback failed. Check the application before creating another organization.';

export const Auth: React.FC<AuthProps> = ({
  onTokenReceived,
  gatewayUrl = 'https://gateway.dev.netsepio.com/',
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [callbackWarning, setCallbackWarning] = useState<string | null>(null);
  const gatewayBaseUrl = gatewayUrl.replace(/\/+$/, '');
  const attempt = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const cancelPending = useRef<(() => void) | null>(null);

  useEffect(() => {
    mounted.current = true;
    attempt.current += 1;
    setIsLoading(inFlight.current);
    setStatus('idle');
    setErrorMsg(null);
    setCallbackWarning(null);
    return () => { mounted.current = false; attempt.current += 1; };
  }, [gatewayBaseUrl]);

  useEffect(() => () => { cancelPending.current?.(); }, []);

  const handleAuth = async () => {
    if (!mounted.current || inFlight.current) return;
    inFlight.current = true;
    const request = ++attempt.current;
    const isCurrent = () => request === attempt.current;
    const notifyTokenReceived = (token: string) => {
      const reportFailure = () => {
        if (mounted.current && isCurrent()) setCallbackWarning(CALLBACK_WARNING);
      };
      try {
        // Application notification errors do not invalidate the completed authentication.
        void Promise.resolve(onTokenReceived(token)).catch(reportFailure);
      } catch {
        reportFailure();
      }
    };
    const controller = typeof AbortController === 'undefined' ? undefined : new AbortController();
    let interrupt: (error: Error) => void = () => {};
    const interrupted = new Promise<never>((_, reject) => { interrupt = reject; });
    const deadline = setTimeout(() => {
      interrupt(new Error('Authentication timed out. The organization may already have been created. Check the gateway before trying again.'));
      controller?.abort();
    }, AUTH_TIMEOUT_MS);
    const cancel = () => {
      clearTimeout(deadline);
      interrupt(new Error('Authentication cancelled'));
      controller?.abort();
    };
    cancelPending.current = cancel;
    // Some native transports do not settle on abort. Bound requests and body reads.
    const bounded = <T,>(work: Promise<T>): Promise<T> => Promise.race([work, interrupted]);
    setIsLoading(true);
    setStatus('idle');
    setErrorMsg(null);
    setCallbackWarning(null);
    try {
      // Step 1: Create organization
      const orgRes = await bounded(fetch(`${gatewayBaseUrl}/api/v1.1/organisation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller?.signal,
      }));
      if (!isCurrent()) return;
      const orgData = await bounded(orgRes.json());
      if (!isCurrent()) return;
      if (!orgRes.ok) {
        const msg = typeof orgData?.message === 'string' && orgData.message.trim()
          ? orgData.message : 'Failed to create organization';
        setErrorMsg(msg);
        setStatus('error');
        console.error('Org creation error:', orgData);
        return;
      }
      const apiKey = orgData?.api_key;
      if (typeof apiKey !== 'string' || !apiKey.trim()) {
        setErrorMsg('No API key returned');
        setStatus('error');
        console.error('No API key in orgData:', orgData);
        return;
      }

      // Step 2: Get token
      const tokenRes = await bounded(fetch(`${gatewayBaseUrl}/api/v1.1/organisation/token`, {
        method: 'GET',
        headers: { 'X-ORG-API-KEY': apiKey },
        signal: controller?.signal,
      }));
      if (!isCurrent()) return;
      const tokenData = await bounded(tokenRes.json());
      if (!isCurrent()) return;
      if (!tokenRes.ok) {
        const msg = typeof tokenData?.message === 'string' && tokenData.message.trim()
          ? tokenData.message : 'Failed to generate token';
        setErrorMsg(msg);
        setStatus('error');
        console.error('Token generation error:', tokenData);
        return;
      }
      const token = tokenData?.payload?.token || tokenData?.payload?.Token;
      if (typeof token !== 'string' || !token.trim()) {
        setErrorMsg('No token returned');
        setStatus('error');
        console.error('No token in tokenData:', tokenData);
        return;
      }

      setStatus('success');
      notifyTokenReceived(token);
    } catch (e: unknown) {
      if (!isCurrent()) return;
      const message = typeof e === 'string' ? e
        : e && typeof e === 'object' && 'message' in e ? e.message : undefined;
      setErrorMsg(typeof message === 'string' && message.trim() ? message : 'Unknown error');
      setStatus('error');
      console.error('Auth error:', e);
    } finally {
      clearTimeout(deadline);
      if (cancelPending.current === cancel) cancelPending.current = null;
      inFlight.current = false;
      if (mounted.current) setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={handleAuth}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Create Organization & Get Token</Text>
        )}
      </TouchableOpacity>
      {status === 'success' && <Text style={styles.success}>Token generated!</Text>}
      {callbackWarning && (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.warning}>{callbackWarning}</Text>
      )}
      {status === 'error' && (
        <Text style={styles.error}>{errorMsg || 'Something went wrong. Try again.'}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    minWidth: 220,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  success: {
    color: '#10b981',
    fontSize: 16,
    marginTop: 8,
  },
  error: {
    color: '#ef4444',
    fontSize: 16,
    marginTop: 8,
  },
  warning: {
    color: '#92400e',
    fontSize: 16,
    marginTop: 8,
  },
});
