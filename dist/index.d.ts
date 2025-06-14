export { VPNProvider, useVPN } from './components/VPNProvider';
export { ClientCreator } from './components/ClientCreator';
export { ConnectionButton } from './components/ConnectionButton';
export { StatusCard } from './components/StatusCard';
export type { WireGuardStatus } from 'react-native-wireguard-vpn';
export interface VPNConfig {
    privateKey: string;
    publicKey: string;
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
export interface Theme {
    background: string;
    surface: string;
    primary: string;
    success: string;
    error: string;
    warning: string;
    text: string;
    textSecondary: string;
    border: string;
}
export declare const defaultTheme: Theme;
