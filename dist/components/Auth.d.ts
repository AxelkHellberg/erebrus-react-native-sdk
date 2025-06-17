import React from 'react';
interface AuthProps {
    onTokenReceived: (token: string) => void;
}
export declare const Auth: React.FC<AuthProps>;
export {};
