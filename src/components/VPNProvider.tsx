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

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const isTextList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isText);

// Validate values crossing the native bridge, including calls from JavaScript consumers.
const isNativeConfig = (value: unknown): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const config = value as VPNConfig;
  return isText(config.privateKey) && isText(config.publicKey) &&
    isText(config.serverAddress) && Number.isInteger(config.serverPort) &&
    config.serverPort >= 1 && config.serverPort <= 65535 &&
    isTextList(config.allowedIPs) && config.allowedIPs.length > 0 &&
    (config.dns === undefined || isTextList(config.dns)) &&
    (config.mtu === undefined || (Number.isInteger(config.mtu) && config.mtu >= 1280 && config.mtu <= 65535)) &&
    (config.presharedKey === undefined || typeof config.presharedKey === 'string');
};

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
  const mounted = useRef(false);
  const lifecycle = useRef(0);
  const statusRequest = useRef(0);
  const operation = useRef<'connect' | 'disconnect' | null>(null);

  const updateStatus = useCallback(async () => {
    if (!mounted.current) return;
    const request = ++statusRequest.current;
    try {
      const status = await WireGuardVpnModule.getStatus();
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
      if (!isNativeConfig(config)) {
        throw new Error("Invalid VPN configuration");
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
