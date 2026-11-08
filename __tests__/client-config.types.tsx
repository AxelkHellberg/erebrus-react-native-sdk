import React from 'react';
import { ClientCreator, useVPN, type VPNConfig } from '../dist';

// A consumer must be able to connect the exact configuration delivered by the SDK.
export function CreateAndConnect() {
  const { connectVPN } = useVPN();
  return (
    <ClientCreator
      apiConfig={{ token: 'test', gatewayUrl: 'https://gateway.example/' }}
      onClientCreated={({ configFile, vpnConfig }) => {
        const address: string = vpnConfig.address;
        const config: VPNConfig = vpnConfig;
        void connectVPN(vpnConfig);
        void [configFile, address, config];
      }}
    />
  );
}
