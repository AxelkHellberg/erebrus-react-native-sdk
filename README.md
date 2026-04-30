# erebrus-react-native-sdk
React Native SDK for implementing Erebrus dVPN in Android and iOS apps

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
- Authentication flow with organization management

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

### Authentication

The SDK includes an authentication flow that handles organization creation and token generation:

```tsx
import { Auth } from 'erebrus-react-native-sdk';

const Authentication = () => {
  const handleTokenReceived = (token: string) => {
    // Store the token and proceed with VPN setup
    console.log('Token received:', token);
  };

  return <Auth onTokenReceived={handleTokenReceived} />;
};
```

The Auth component:
- Creates an organization through the Erebrus gateway
- Exchanges the returned API key for a token
- Calls `onTokenReceived` with the generated token

### Using the Connection Button

```tsx
import { useCallback } from 'react';
import { ConnectionButton, useVPN, type VPNConfig } from 'erebrus-react-native-sdk';

const VPNConnection = ({ vpnConfig }: { vpnConfig: VPNConfig | null }) => {
  const { vpnStatus, isConnecting, isDisconnecting, connectVPN, disconnectVPN } = useVPN();

  const handleConnect = useCallback(() => {
    if (vpnConfig) {
      connectVPN(vpnConfig);
    }
  }, [connectVPN, vpnConfig]);

  return (
    <ConnectionButton
      isConnected={vpnStatus?.isConnected || false}
      isConnecting={isConnecting}
      isDisconnecting={isDisconnecting}
      onConnect={handleConnect}
      onDisconnect={disconnectVPN}
      theme={customTheme} // Optional theme customization
    />
  );
};
```

`connectVPN` expects a `VPNConfig` object, so the usual flow is:

1. Render `ClientCreator`
2. Store the returned `vpnConfig`
3. Call `connectVPN(vpnConfig)` from your connect button handler

### Creating a New VPN Client

```tsx
import { ClientCreator } from 'erebrus-react-native-sdk';

const CreateClient = () => {
  const handleClientCreated = ({ configFile, vpnConfig }) => {
    console.log('Client created:', configFile);
    // The configFile can be used to generate a QR code.
    // Store vpnConfig and pass it to connectVPN when the user taps Connect.
  };

  return (
    <ClientCreator
      apiConfig={{
        token: 'your-api-token', // Token received from Auth component
        gatewayUrl: 'https://gateway.dev.netsepio.com/',
      }}
      onClientCreated={handleClientCreated}
      theme={customTheme} // Optional theme customization
    />
  );
};
```

### Displaying VPN Status

```tsx
import { StatusCard, useVPN } from 'erebrus-react-native-sdk';

const VPNStatus = () => {
  const { vpnStatus } = useVPN();

  return (
    <StatusCard 
      vpnStatus={vpnStatus} 
      theme={customTheme} // Optional theme customization
    />
  );
};
```

### Complete Example

Here's a complete example showing the expected flow: authenticate, create a client, store the returned `vpnConfig`, and connect with that config.

```tsx
import { 
  VPNProvider, 
  Auth, 
  StatusCard, 
  ConnectionButton, 
  ClientCreator,
  useVPN 
} from 'erebrus-react-native-sdk';
import { SafeAreaView, Text, TouchableOpacity, Modal } from 'react-native';
import { useCallback, useState } from 'react';

const VPNScreen = () => {
  const { vpnStatus, isConnecting, isDisconnecting, connectVPN, disconnectVPN } = useVPN();
  const [token, setToken] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [vpnConfig, setVpnConfig] = useState(null);

  const handleClientCreated = ({ vpnConfig }) => {
    setVpnConfig(vpnConfig);
    setShowCreateModal(false);
  };

  const handleConnect = useCallback(() => {
    if (vpnConfig) {
      connectVPN(vpnConfig);
    }
  }, [connectVPN, vpnConfig]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Authentication Section */}
      <Auth onTokenReceived={setToken} />

      {/* VPN Status Section */}
      <StatusCard vpnStatus={vpnStatus} />

      {/* Connection Controls */}
      <ConnectionButton
        isConnected={vpnStatus?.isConnected || false}
        isConnecting={isConnecting}
        isDisconnecting={isDisconnecting}
        onConnect={handleConnect}
        onDisconnect={disconnectVPN}
      />

      {/* Create Client Button */}
      <TouchableOpacity onPress={() => setShowCreateModal(true)}>
        <Text>Create New Client</Text>
      </TouchableOpacity>

      {/* Create Client Modal */}
      {showCreateModal && (
        <Modal>
          <ClientCreator
            apiConfig={{
              token,
              gatewayUrl: 'https://gateway.dev.netsepio.com/',
            }}
            onClientCreated={handleClientCreated}
          />
        </Modal>
      )}
    </SafeAreaView>
  );
};

const App = () => (
  <VPNProvider>
    <VPNScreen />
  </VPNProvider>
);
```

### Customizing the Theme

`ConnectionButton`, `ClientCreator`, and `StatusCard` accept a theme prop for customization:

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

### Auth

The authentication component that handles organization creation and token generation.

#### Props

- `onTokenReceived`: Callback function that receives the generated token

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
  - `token`: API token (received from Auth component)
  - `gatewayUrl`: API gateway URL
- `onClientCreated`: Callback when a client is created
  - Receives `{ configFile, vpnConfig }` object
  - `configFile`: String containing the WireGuard configuration
  - `vpnConfig`: Object containing the VPN configuration for connection
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
