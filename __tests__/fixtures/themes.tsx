import React from 'react';
import { Auth, ClientCreator, type Theme } from 'erebrus-react-native-sdk';
import { Auth as DirectAuth } from 'erebrus-react-native-sdk/components/Auth';
import { ClientCreator as DirectClientCreator } from 'erebrus-react-native-sdk/components/ClientCreator';

const props = {
  apiConfig: { token: '', gatewayUrl: 'https://gateway.example/' },
  onClientCreated: () => {},
};

// Consumers can customize only the fallback status colors through either entry point.
<ClientCreator {...props} theme={{ success: '#123456', error: '#654321' }} />;
<DirectClientCreator {...props} theme={{ success: '#123456' }} />;
<Auth onTokenReceived={() => {}} theme={{ error: '#654321' }} />;
<DirectAuth onTokenReceived={() => {}} theme={{ success: '#123456' }} />;
<ClientCreator {...props} theme={{}} />;

const sharedTheme: Theme = {
  surface: '#fff', background: '#eee', text: '#000', textSecondary: '#666',
  primary: '#123456', border: '#ddd', success: '#0f0', error: '#f00', warning: '#ff0',
};
<ClientCreator {...props} theme={sharedTheme} />;
<Auth onTokenReceived={() => {}} theme={sharedTheme} />;

// Invalid values and misspelled properties remain compile-time errors.
// @ts-expect-error Theme colors must be strings.
<ClientCreator {...props} theme={{ success: 123 }} />;
// @ts-expect-error Unknown theme properties are rejected.
<ClientCreator {...props} theme={{ succes: '#123456' }} />;
// @ts-expect-error Auth follows the same string-valued theme contract.
<Auth onTokenReceived={() => {}} theme={{ error: false }} />;
