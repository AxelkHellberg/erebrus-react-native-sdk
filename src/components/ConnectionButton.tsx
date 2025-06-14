import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';

interface ConnectionButtonProps {
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  theme?: {
    success: string;
    error: string;
    textSecondary: string;
  };
}

export const ConnectionButton: React.FC<ConnectionButtonProps> = ({
  isConnected,
  isConnecting,
  isDisconnecting,
  onConnect,
  onDisconnect,
  theme = {
    success: '#10b981',
    error: '#ef4444',
    textSecondary: '#6b7280',
  },
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    if (isConnected) {
      onDisconnect();
    } else {
      onConnect();
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor: isConnected ? theme.error : theme.success,
              borderWidth: 4,
              borderColor: isConnected ? theme.error : theme.success,
            },
          ]}
          onPress={handlePress}
          disabled={isConnecting || isDisconnecting}
        >
          {(isConnecting || isDisconnecting) ? (
            <ActivityIndicator color="#ffffff" size="large" />
          ) : (
            <>
              <Text style={styles.buttonText}>
                {isConnected ? "Disconnect" : "Connect"}
              </Text>
              <Text style={styles.buttonSubtext}>
                {isConnected ? "Tap to disconnect" : "Tap to connect"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
      <Text style={[styles.status, { color: theme.textSecondary }]}>
        {isConnected ? "Your connection is secure" : "Your connection is not secure"}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 30,
  },
  button: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  buttonSubtext: {
    color: '#ffffff',
    fontSize: 14,
    opacity: 0.8,
  },
  status: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
}); 