import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface AuthProps {
  onTokenReceived: (token: string) => void;
}

export const Auth: React.FC<AuthProps> = ({ onTokenReceived }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleAuth = async () => {
    setIsLoading(true);
    setStatus('idle');
    try {
      // Step 1: Create organization
      const orgRes = await fetch('https://gateway.dev.netsepio.com/api/v1.1/organisation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!orgRes.ok) throw new Error('Failed to create organization');
      const orgData = await orgRes.json();
      const apiKey = orgData.api_key;
      if (!apiKey) throw new Error('No API key returned');

      // Step 2: Get token
      const tokenRes = await fetch('https://gateway.dev.netsepio.com/api/v1.1/organisation/token', {
        method: 'GET',
        headers: { 'X-API-Key': apiKey },
      });
      if (!tokenRes.ok) throw new Error('Failed to generate token');
      const tokenData = await tokenRes.json();
      const token = tokenData?.payload?.Token;
      if (!token) throw new Error('No token returned');

      setStatus('success');
      onTokenReceived(token);
    } catch (e) {
      setStatus('error');
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
      {status === 'error' && <Text style={styles.error}>Something went wrong. Try again.</Text>}
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