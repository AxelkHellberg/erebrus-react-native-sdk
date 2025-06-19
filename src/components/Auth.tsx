import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface AuthProps {
  onTokenReceived: (token: string) => void;
}

export const Auth: React.FC<AuthProps> = ({ onTokenReceived }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        headers: { 'X-API-Key': apiKey },
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
}); 