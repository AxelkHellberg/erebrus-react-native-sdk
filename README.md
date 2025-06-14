# erebrus-react-native-sdk
React Native SDK for implementing Erebrus dVPN in Android and iOS apps
# Erebrus VPN SDK for React Native

A React Native SDK for integrating Erebrus VPN functionality into your mobile applications.

## Installation

```bash
npm install erebrus-react-native-sdk
# or
yarn add erebrus-react-native-sdk
```

## Features

- VPN connection management
- Client creation and configuration
- QR code generation for WireGuard configuration
- Status monitoring
- Customizable UI components
- TypeScript support

## Usage

### Basic Setup

Wrap your app with the `VPNProvider`:

```tsx
import { VPNProvider } from 'erebrus-react-native-sdk';

const App = () => {
  return (
    <VPNProvider>
      <YourApp />
    </VPNProvider>
  );
};
```

### Using the Connection Button

```tsx
import { ConnectionButton, useVPN } from 'erebrus-react-native-sdk';

const VPNConnection = () => {
  const { vpnStatus, isConnecting, isDisconnecting, connectVPN, disconnectVPN } = useVPN();

  return (
    <ConnectionButton
      isConnected={vpnStatus?.isConnected || false}
      isConnecting={isConnecting}
      isDisconnecting={isDisconnecting}
      onConnect={connectVPN}
      onDisconnect={disconnectVPN}
    />
  );
};
```

### Creating a New VPN Client

```tsx
import { ClientCreator } from 'erebrus-react-native-sdk';

const CreateClient = () => {
  const handleClientCreated = ({ configFile, vpnConfig }) => {
    console.log('Client created:', configFile);
    // Handle the new client configuration
  };

  return (
    <ClientCreator
      apiConfig={{
        token: 'your-api-token',
        gatewayUrl: 'https://gateway.erebrus.io/',
      }}
      onClientCreated={handleClientCreated}
    />
  );
};
```

### Displaying VPN Status

```tsx
import { StatusCard, useVPN } from 'erebrus-react-native-sdk';

const VPNStatus = () => {
  const { vpnStatus } = useVPN();

  return <StatusCard vpnStatus={vpnStatus} />;
};
```

### Customizing the Theme

All components accept a theme prop for customization:

```tsx
const customTheme = {
  background: '#1a1a1a',
  surface: '#2a2a2a',
  primary: '#6366f1',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  text: '#ffffff',
  textSecondary: '#a1a1aa',
  border: '#374151',
};

<ConnectionButton
  theme={customTheme}
  // ... other props
/>
```

## API Reference

### VPNProvider

The main provider component that manages VPN state and functionality.

#### Props

- `children`: React nodes to be wrapped by the provider

### useVPN Hook

A hook that provides access to VPN functionality.

#### Returns

- `vpnStatus`: Current VPN status
- `isConnecting`: Whether the VPN is currently connecting
- `isDisconnecting`: Whether the VPN is currently disconnecting
- `isInitialized`: Whether the VPN module is initialized
- `connectVPN`: Function to connect to VPN
- `disconnectVPN`: Function to disconnect from VPN
- `updateStatus`: Function to update VPN status

### ConnectionButton

A customizable button component for VPN connection control.

#### Props

- `isConnected`: Whether the VPN is connected
- `isConnecting`: Whether the VPN is connecting
- `isDisconnecting`: Whether the VPN is disconnecting
- `onConnect`: Function to call when connecting
- `onDisconnect`: Function to call when disconnecting
- `theme`: Optional theme object for customization

### ClientCreator

A component for creating new VPN clients.

#### Props

- `apiConfig`: Configuration for the API
  - `token`: API token
  - `gatewayUrl`: API gateway URL
- `onClientCreated`: Callback when a client is created
- `theme`: Optional theme object for customization

### StatusCard

A component for displaying VPN status information.

#### Props

- `vpnStatus`: Current VPN status
- `theme`: Optional theme object for customization

## Types

The SDK includes TypeScript types for all components and functions:

- `VPNConfig`
- `Node`
- `Region`
- `Theme`
- `WireGuardStatus`

## License

MIT
