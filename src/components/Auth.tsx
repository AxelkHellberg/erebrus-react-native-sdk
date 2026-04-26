import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface AuthTheme {
  background: string;
  surface: string;
  primary: string;
  text: string;
  success: string;
  error: string;
  border: string;
}

interface AuthProps {
  onTokenReceived: (token: string) => void;
  theme?: Partial<AuthTheme>;
}

const defaultTheme: AuthTheme = {
  background: '#f5f5f5',
  surface: '#ffffff',
  primary: '#007AFF',
  text: '#000000',
  success: '#10b981',
  error: '#ef4444',
  border: '#e5e7eb',
};

export const Auth: React.FC<AuthProps> = ({ onTokenReceived, theme }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const resolvedTheme = { ...defaultTheme, ...theme };

  const handleAuth = async () => {
    setIsLoading(true);
    setStatus('idle');
    setErrorMsg(null);
    try {
      // Step 1: Create organization
      const orgRes = await fetch('https://gateway.dev.netsepio.com/api/v1.1/organisation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const orgData = await orgRes.json();
      if (!orgRes.ok) {
        const msg = orgData?.message || 'Failed to create organization';
        setErrorMsg(msg);
        setStatus('error');
        console.error('Org creation error:', orgData);
        return;
      }
      const apiKey = orgData.api_key;
      if (!apiKey) {
        setErrorMsg('No API key returned');
        setStatus('error');
        console.error('No API key in orgData:', orgData);
        return;
      }

      // Step 2: Get token
      const tokenRes = await fetch('https://gateway.dev.netsepio.com/api/v1.1/organisation/token', {
        method: 'GET',
        headers: { 'X-ORG-API-KEY': apiKey },
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        const msg = tokenData?.message || 'Failed to generate token';
        setErrorMsg(msg);
        setStatus('error');
        console.error('Token generation error:', tokenData);
        return;
      }
      const token = tokenData?.payload?.token || tokenData?.payload?.Token;
      if (!token) {
        setErrorMsg('No token returned');
        setStatus('error');
        console.error('No token in tokenData:', tokenData);
        return;
      }

      setStatus('success');
      onTokenReceived(token);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Unknown error');
      setStatus('error');
      console.error('Auth error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: resolvedTheme.background }]}>
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: resolvedTheme.primary,
            borderColor: resolvedTheme.border,
          },
        ]}
        onPress={handleAuth}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.buttonText, { color: resolvedTheme.surface }]}>
            Create Organization & Get Token
          </Text>
        )}
      </TouchableOpacity>
      {status === 'success' && (
        <Text style={[styles.success, { color: resolvedTheme.success }]}>Token generated!</Text>
      )}
      {status === 'error' && (
        <Text style={[styles.error, { color: resolvedTheme.error }]}>
          {errorMsg || 'Something went wrong. Try again.'}
        </Text>
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
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 220,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  success: {
    fontSize: 16,
    marginTop: 8,
  },
  error: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
});
