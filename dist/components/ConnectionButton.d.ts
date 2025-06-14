import React from 'react';
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
export declare const ConnectionButton: React.FC<ConnectionButtonProps>;
export {};
