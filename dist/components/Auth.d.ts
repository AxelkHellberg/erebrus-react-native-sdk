import React from 'react';
interface AuthTheme {
    background: string;
    surface: string;
    primary: string;
    text: string;
    success: string;
    error: string;
    border: string;
}
interface AuthProps {
    onTokenReceived: (token: string) => void;
    theme?: Partial<AuthTheme>;
}
export declare const Auth: React.FC<AuthProps>;
export {};
