export { VPNProvider, useVPN } from './components/VPNProvider';
export { ClientCreator } from './components/ClientCreator';
export { ConnectionButton } from './components/ConnectionButton';
export { StatusCard } from './components/StatusCard';
export { Auth } from './components/Auth';
export type { WireGuardStatus } from 'react-native-wireguard-vpn-connect';
export type { Theme } from './types/theme';
import type { Theme } from './types/theme';
export interface VPNConfig {
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
export interface Node {
    id: string;
    name: string;
    region: string;
    status: string;
    chainName: string;
    walletAddress: string;
}
export interface Region {
    id: string;
    name: string;
}
export declare const defaultTheme: Theme;
