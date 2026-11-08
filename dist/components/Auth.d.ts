import React from 'react';
interface AuthProps {
    onTokenReceived: (token: string) => void;
    gatewayUrl?: string;
}
export declare const Auth: React.FC<AuthProps>;
export {};
