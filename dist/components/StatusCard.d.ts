import React from 'react';
import { type WireGuardStatus } from 'react-native-wireguard-vpn';
interface StatusCardProps {
    vpnStatus: WireGuardStatus | null;
    theme?: {
        surface: string;
        border: string;
        text: string;
        textSecondary: string;
        success: string;
        error: string;
    };
}
export declare const StatusCard: React.FC<StatusCardProps>;
export {};
