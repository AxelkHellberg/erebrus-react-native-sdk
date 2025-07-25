import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import WireGuardVpnModule, { type WireGuardStatus } from "react-native-wireguard-vpn-connect";
import { Alert } from 'react-native';

interface VPNConfig {
  privateKey: string;
  publicKey: string;
  address: string;
  serverAddress: string;
  serverPort: number;
  allowedIPs: string[];
  dns?: string[];
  mtu?: number;
  presharedKey?: string;
  persistentKeepalive?: number;
}

interface VPNContextType {
  vpnStatus: WireGuardStatus | null;
  isConnecting: boolean;
  isDisconnecting: boolean;
  isInitialized: boolean;
  connectVPN: (config: VPNConfig) => Promise<void>;
  disconnectVPN: () => Promise<void>;
  updateStatus: () => Promise<void>;
}

const VPNContext = createContext<VPNContextType | undefined>(undefined);

export const useVPN = () => {
  const context = useContext(VPNContext);
  if (!context) {
    throw new Error('useVPN must be used within a VPNProvider');
  }
  return context;
};

interface VPNProviderProps {
  children: React.ReactNode;
}

export const VPNProvider: React.FC<VPNProviderProps> = ({ children }) => {
  const [vpnStatus, setVpnStatus] = useState<WireGuardStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const initializeVPN = useCallback(async () => {
    try {
      await WireGuardVpnModule.initialize();
      setIsInitialized(true);
      await updateStatus();
    } catch (error: any) {
      console.error("VPN initialization failed:", error);
      Alert.alert("Initialization Error", error.message || "Unknown error occurred");
    }
  }, []);

  const updateStatus = useCallback(async () => {
    try {
      const status = await WireGuardVpnModule.getStatus();
      setVpnStatus(status);
    } catch (error: any) {
      console.error("Failed to get VPN status:", error);
    }
  }, []);

  const connectVPN = useCallback(async (config: VPNConfig) => {
    if (isConnecting || !isInitialized) {
      return;
    }

    setIsConnecting(true);
    try {
      if (!config.privateKey || !config.publicKey) {
        throw new Error("Invalid cryptographic keys");
      }

      await WireGuardVpnModule.connect(config);
      await updateStatus();
    } catch (error: any) {
      console.error("Connection failed:", error);
      let errorMessage = error.message || "Unknown error occurred";
      if (errorMessage.includes("KeyFormat")) {
        errorMessage = "Invalid key format";
      } else if (errorMessage.includes("timeout")) {
        errorMessage = "Connection timeout";
      }
      Alert.alert("Connection Failed", errorMessage);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, isInitialized, updateStatus]);

  const disconnectVPN = useCallback(async () => {
    if (isDisconnecting) return;

    setIsDisconnecting(true);
    try {
      await WireGuardVpnModule.disconnect();
      await updateStatus();
    } catch (error: any) {
      console.error("Disconnection failed:", error);
      Alert.alert("Disconnection Failed", error.message || "Unknown error occurred");
    } finally {
      setIsDisconnecting(false);
    }
  }, [isDisconnecting, updateStatus]);

  useEffect(() => {
    initializeVPN();
  }, [initializeVPN]);

  const value = {
    vpnStatus,
    isConnecting,
    isDisconnecting,
    isInitialized,
    connectVPN,
    disconnectVPN,
    updateStatus,
  };

  return <VPNContext.Provider value={value}>{children}</VPNContext.Provider>;
}; 