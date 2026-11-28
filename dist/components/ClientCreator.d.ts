import 'react-native-get-random-values';
import React from 'react';
import type { Theme } from '../types/theme';
interface ClientCreatorProps {
    apiConfig: {
        token: string;
        gatewayUrl: string;
    };
    onClientCreated: (config: {
        configFile: string;
        vpnConfig: {
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
        };
    }) => void;
    theme?: Partial<Theme>;
}
export declare const ClientCreator: React.FC<ClientCreatorProps>;
export {};
