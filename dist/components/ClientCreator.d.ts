import 'react-native-get-random-values';
import React from 'react';
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
            serverAddress: string;
            serverPort: number;
            allowedIPs: string[];
            dns?: string[];
            mtu?: number;
            presharedKey?: string;
            persistentKeepalive?: number;
        };
    }) => void;
    theme?: {
        surface: string;
        background: string;
        text: string;
        textSecondary: string;
        primary: string;
        border: string;
    };
}
export declare const ClientCreator: React.FC<ClientCreatorProps>;
export {};
