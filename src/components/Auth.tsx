import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';

interface AuthProps {
  onTokenReceived: (token: string) => void;
}

interface OrganizationResponse {
  id: string;
  name: string;
  ip_address: string;
  api_key: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TokenResponse {
  status: number;
  message: string;
  payload: {
    OrganisationId: string;
    Token: string;
  };
}

export const Auth: React.FC<AuthProps> = ({ onTokenReceived }) => {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const createOrganization = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('https://gateway.dev.netsepio.com/api/v1.1/organisation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data: OrganizationResponse = await response.json();
      setApiKey(data.api_key);
      Alert.alert('Success', 'Organization created successfully! API Key: ' + data.api_key);
    } catch (error) {
      Alert.alert('Error', 'Failed to create organization');
      console.error('Error creating organization:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getToken = async () => {
    if (!apiKey) {
      Alert.alert('Error', 'Please create an organization first or enter an API key');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('https://gateway.dev.netsepio.com/api/v1.1/organisation/token', {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
        },
      });

      const data: TokenResponse = await response.json();
      if (data.status === 200) {
        onTokenReceived(data.payload.Token);
        Alert.alert('Success', 'Token generated successfully!');
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate token');
      console.error('Error generating token:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Authentication</Text>
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={createOrganization}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Creating...' : 'Create New Organization'}
        </Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Enter API Key"
        value={apiKey}
        onChangeText={setApiKey}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity 
        style={styles.button} 
        onPress={getToken}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Generating...' : 'Generate Token'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 5,
    marginBottom: 15,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
}); 