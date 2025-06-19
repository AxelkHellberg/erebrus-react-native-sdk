import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import { generateKeyPair } from 'curve25519-js';
import QRCode from 'react-native-qrcode-svg';
import { Auth } from './Auth';
// @ts-ignore
import { Picker } from 'react-native';

interface Node {
  id: string;
  name: string;
  region: string;
  status: string;
  chainName: string;
  walletAddress: string;
}

interface Region {
  id: string;
  name: string;
}

interface ClientCreatorProps {
  apiConfig: {
    token: string;
    gatewayUrl: string;
  };
  onClientCreated: (config: {
    configFile: string;
    vpnConfig: {
      privateKey: string;
      publicKey: string;
      serverAddress: string;
      serverPort: number;
      allowedIPs: string[];
      dns?: string[];
      mtu?: number;
      presharedKey?: string;
      persistentKeepalive?: number;
    };
  }) => void;
  theme?: {
    surface: string;
    background: string;
    text: string;
    textSecondary: string;
    primary: string;
    border: string;
  };
}

const REGIONS: Region[] = [
  { id: "SG", name: "Singapore" },
  { id: "IN", name: "India" },
  { id: "US", name: "United States" },
  { id: "JP", name: "Japan" },
  { id: "CA", name: "Canada" },
  { id: "GB", name: "United Kingdom" },
  { id: "AU", name: "Australia" },
  { id: "DE", name: "Germany" },
];

export const ClientCreator: React.FC<ClientCreatorProps> = ({
  apiConfig,
  onClientCreated,
  theme = {
    surface: '#ffffff',
    background: '#f5f5f5',
    text: '#000000',
    textSecondary: '#6b7280',
    primary: '#6366f1',
    border: '#e5e7eb',
  },
}) => {
  const [newClientName, setNewClientName] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [nodesData, setNodesData] = useState<Node[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [showQrCode, setShowQrCode] = useState(false);
  const [configFile, setConfigFile] = useState('');
  const [token, setToken] = useState(apiConfig.token);
  const [isLoadingNodes, setIsLoadingNodes] = useState(false);
  const [nodesError, setNodesError] = useState<string | null>(null);

  const handleTokenReceived = (newToken: string) => {
    setToken(newToken);
  };

  const generateKeys = () => {
    try {
      const preSharedKey = CryptoJS.lib.WordArray.random(32);
      const preSharedKeyB64 = preSharedKey.toString(CryptoJS.enc.Base64);
      const randomBytes = CryptoJS.lib.WordArray.random(32);
      const randomBytesArray = new Uint8Array(randomBytes.words.length * 4);
      for (let i = 0; i < randomBytes.words.length; i++) {
        const word = randomBytes.words[i];
        randomBytesArray[i * 4] = (word >>> 24) & 0xff;
        randomBytesArray[i * 4 + 1] = (word >>> 16) & 0xff;
        randomBytesArray[i * 4 + 2] = (word >>> 8) & 0xff;
        randomBytesArray[i * 4 + 3] = word & 0xff;
      }
      const keyPair = generateKeyPair(randomBytesArray);
      const privKey = Buffer.from(keyPair.private).toString('base64');
      const pubKey = Buffer.from(keyPair.public).toString('base64');
      return {
        preSharedKey: preSharedKeyB64,
        privKey,
        pubKey,
      };
    } catch (error) {
      console.error('Key generation failed:', error);
      throw new Error('Failed to generate cryptographic keys');
    }
  };

  const fetchNodesData = useCallback(async () => {
    if (!token) {
      setNodesError('Please authenticate first');
      return;
    }
    setIsLoadingNodes(true);
    setNodesError(null);
    try {
      const response = await axios.get(`${apiConfig.gatewayUrl}api/v1.0/nodes/all`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.status === 200) {
        const payload = response.data.payload;
        const filteredNodes = payload.filter(
          (node: Node) =>
            node.status === 'active' && node.region !== undefined && node.region !== null && node.region.trim(),
        );
        setNodesData(filteredNodes);
      } else {
        setNodesError('Failed to fetch available nodes');
      }
    } catch (error) {
      setNodesError('Failed to fetch available nodes');
      console.error('Error fetching nodes data:', error);
    } finally {
      setIsLoadingNodes(false);
    }
  }, [apiConfig, token]);

  React.useEffect(() => {
    fetchNodesData();
  }, [fetchNodesData]);

  const createVPNClient = useCallback(async () => {
    if (!token) {
      Alert.alert('Error', 'Please authenticate first');
      return;
    }
    const selectedNode = nodesData.find((n) => n.id === selectedNodeId);
    if (!selectedNode) {
      Alert.alert('Error', 'Please select a node first');
      return;
    }
    setIsCreatingClient(true);
    try {
      const keys = generateKeys();
      const requestData = {
        name: newClientName,
        presharedKey: keys.preSharedKey,
        publicKey: keys.pubKey,
      };
      const response = await axios.post(
        `${apiConfig.gatewayUrl}api/v1.0/erebrus/client/${selectedNode.id}`,
        requestData,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (response.status === 200) {
        const data = response.data;
        const client = data.payload.client;
        const configFile = `
[Interface]
Address = ${client.Address[0]}
PrivateKey = ${keys.privKey}
DNS = 1.1.1.1

[Peer]
PublicKey = ${data.payload.serverPublicKey}
PresharedKey = ${client.PresharedKey}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${data.payload.endpoint}:51820
PersistentKeepalive = 16`;
        setConfigFile(configFile);
        setShowQrCode(true);
        const vpnConfig = {
          privateKey: keys.privKey,
          publicKey: keys.pubKey,
          serverAddress: data.payload.endpoint,
          serverPort: 51820,
          allowedIPs: ['0.0.0.0/0', '::/0'],
          dns: ['1.1.1.1', '8.8.8.8'],
          mtu: 1280,
          presharedKey: client.PresharedKey,
          persistentKeepalive: 16,
        };
        onClientCreated({ configFile, vpnConfig });
      }
    } catch (error: any) {
      console.error('Failed to create VPN client:', error);
      let errorMessage = 'Failed to create VPN client: ';
      if (error.response?.data?.message) {
        errorMessage += error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage += error.response.data.error;
      } else {
        errorMessage += error.message || 'Unknown error occurred';
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setIsCreatingClient(false);
    }
  }, [apiConfig, token, selectedNodeId, newClientName, nodesData, onClientCreated]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {!token ? (
        <Auth onTokenReceived={handleTokenReceived} />
      ) : (
        <>
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Create New Client</Text>
            <View style={styles.form}>
              <Text style={[styles.label, { color: theme.text }]}>Client Name</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                value={newClientName}
                onChangeText={setNewClientName}
                placeholder="Enter client name (max 8 chars)"
                placeholderTextColor={theme.textSecondary}
                maxLength={8}
              />

              <Text style={[styles.label, { color: theme.text }]}>Region</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={selectedRegion}
                  onValueChange={(itemValue: string) => {
                    setSelectedRegion(itemValue);
                    setSelectedNodeId('');
                  }}
                  style={{ color: theme.text }}
                >
                  <Picker.Item label="Select a region" value="" />
                  {REGIONS.map((region) => (
                    <Picker.Item key={region.id} label={region.name} value={region.id} />
                  ))}
                </Picker>
              </View>

              <Text style={[styles.label, { color: theme.text }]}>Node</Text>
              {isLoadingNodes ? (
                <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 10 }} />
              ) : nodesError ? (
                <Text style={{ color: '#ef4444', marginBottom: 10 }}>{nodesError}</Text>
              ) : (
                <View style={styles.pickerWrapper}>
                  <Picker
                    enabled={!!selectedRegion && nodesData.filter((n) => n.region === selectedRegion).length > 0}
                    selectedValue={selectedNodeId}
                    onValueChange={(itemValue: string) => {
                      setSelectedNodeId(itemValue);
                    }}
                    style={{ color: theme.text }}
                  >
                    <Picker.Item label="Select a node" value="" />
                    {nodesData
                      .filter((node) => node.region === selectedRegion)
                      .map((node) => (
                        <Picker.Item
                          key={node.id}
                          label={`${node.name || node.id.slice(0, 8)} (${node.chainName})`}
                          value={node.id}
                        />
                      ))}
                  </Picker>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.createButton,
                  {
                    backgroundColor: theme.primary,
                    opacity: !newClientName || !selectedRegion || !selectedNodeId || isCreatingClient ? 0.5 : 1,
                  },
                ]}
                onPress={createVPNClient}
                disabled={!newClientName || !selectedRegion || !selectedNodeId || isCreatingClient}
              >
                {isCreatingClient ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.createButtonText}>Create Client</Text>
                )}
              </TouchableOpacity>
            </View>

            {showQrCode && configFile && (
              <View style={styles.qrCodeContainer}>
                <QRCode value={configFile} size={200} backgroundColor={theme.surface} color={theme.text} />
                <Text style={[styles.qrCodeText, { color: theme.textSecondary }]}>
                  Scan this QR code with the WireGuard app
                </Text>
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 16,
  },
  section: {
    padding: 20,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  createButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  qrCodeContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  qrCodeText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
}); 