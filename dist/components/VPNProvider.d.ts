import React from 'react';
import { type WireGuardStatus } from "react-native-wireguard-vpn-connect";
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
export declare const useVPN: () => VPNContextType;
interface VPNProviderProps {
    children: React.ReactNode;
}
export declare const VPNProvider: React.FC<VPNProviderProps>;
export {};
