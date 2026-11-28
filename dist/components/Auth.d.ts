import React from 'react';
import type { Theme } from '../types/theme';
interface AuthProps {
    onTokenReceived: (token: string) => void;
    theme?: Partial<Theme>;
}
export declare const Auth: React.FC<AuthProps>;
export {};
