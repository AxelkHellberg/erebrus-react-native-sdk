import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
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

function isVPNStatus(value: unknown): value is WireGuardStatus {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const status = value as Record<string, unknown>;
  // Native iOS uses state names beyond the TypeScript union. Keep those strings.
  return typeof status.isConnected === 'boolean' &&
    (status.tunnelState === undefined || typeof status.tunnelState === 'string') &&
    (status.error === undefined || typeof status.error === 'string') &&
    (status.vpnPermissionGranted === undefined || typeof status.vpnPermissionGranted === 'boolean');
}

export const VPNProvider: React.FC<VPNProviderProps> = ({ children }) => {
  const [vpnStatus, setVpnStatus] = useState<WireGuardStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const mounted = useRef(false);
  const lifecycle = useRef(0);
  const statusRequest = useRef(0);
  const operation = useRef<'connect' | 'disconnect' | null>(null);

  const updateStatus = useCallback(async () => {
    if (!mounted.current) return;
    const request = ++statusRequest.current;
    try {
      const nativeStatus = await WireGuardVpnModule.getStatus();
      // Android can return a null error when an exception has no message.
      const status = nativeStatus?.error === null ? { ...nativeStatus, error: undefined } : nativeStatus;
      if (!isVPNStatus(status)) throw new Error('Invalid native VPN status');
      if (mounted.current && request === statusRequest.current) setVpnStatus(status);
    } catch (error: any) {
      if (mounted.current && request === statusRequest.current) {
        console.error("Failed to get VPN status:", error);
      }
    }
  }, []);

  const connectVPN = useCallback(async (config: VPNConfig) => {
    if (!mounted.current || operation.current !== null || !isInitialized) {
      return;
    }

    const generation = lifecycle.current;
    const isCurrent = () => mounted.current && lifecycle.current === generation;
    operation.current = 'connect';
    setIsConnecting(true);
    try {
      if (!config.privateKey || !config.publicKey) {
        throw new Error("Invalid cryptographic keys");
      }

      await WireGuardVpnModule.connect(config);
      if (isCurrent()) await updateStatus();
    } catch (error: any) {
      if (!isCurrent()) return;
      console.error("Connection failed:", error);
      let errorMessage = error.message || "Unknown error occurred";
      if (errorMessage.includes("KeyFormat")) {
        errorMessage = "Invalid key format";
      } else if (errorMessage.includes("timeout")) {
        errorMessage = "Connection timeout";
      }
      Alert.alert("Connection Failed", errorMessage);
    } finally {
      operation.current = null;
      if (isCurrent()) setIsConnecting(false);
    }
  }, [isInitialized, updateStatus]);

  const disconnectVPN = useCallback(async () => {
    if (!mounted.current || operation.current !== null) return;

    const generation = lifecycle.current;
    const isCurrent = () => mounted.current && lifecycle.current === generation;
    operation.current = 'disconnect';
    setIsDisconnecting(true);
    try {
      await WireGuardVpnModule.disconnect();
      if (isCurrent()) await updateStatus();
    } catch (error: any) {
      if (!isCurrent()) return;
      console.error("Disconnection failed:", error);
      Alert.alert("Disconnection Failed", error.message || "Unknown error occurred");
    } finally {
      operation.current = null;
      if (isCurrent()) setIsDisconnecting(false);
    }
  }, [updateStatus]);

  useEffect(() => {
    mounted.current = true;
    const generation = ++lifecycle.current;
    const isCurrent = () => mounted.current && lifecycle.current === generation;
    const initializeVPN = async () => {
      try {
        await WireGuardVpnModule.initialize();
        if (!isCurrent()) return;
        setIsInitialized(true);
        await updateStatus();
      } catch (error: any) {
        if (!isCurrent()) return;
        console.error("VPN initialization failed:", error);
        Alert.alert("Initialization Error", error.message || "Unknown error occurred");
      }
    };
    void initializeVPN();
    return () => {
      mounted.current = false;
      lifecycle.current += 1;
      statusRequest.current += 1;
    };
  }, [updateStatus]);

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
