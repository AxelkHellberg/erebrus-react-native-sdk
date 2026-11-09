import 'react-native-get-random-values';
import { Buffer } from 'buffer';
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  FlatList,
  Modal,
} from 'react-native';
import axios from 'axios';
import { generateKeyPair } from 'curve25519-js';
import QRCode from 'react-native-qrcode-svg';
import { Auth } from './Auth';
// @ts-ignore

interface Node {
  id: string;
  name?: string;
  region: string;
  status: string;
  chainName?: string;
  walletAddress?: string;
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
  const gatewayUrl = apiConfig.gatewayUrl.replace(/\/+$/, '') + '/';
  const [newClientName, setNewClientName] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const creationInFlight = useRef(false);
  const creationGeneration = useRef(0);
  const mounted = useRef(false);
  const [nodesData, setNodesData] = useState<Node[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [selectedNodeName, setSelectedNodeName] = useState('');
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [configFile, setConfigFile] = useState('');
  const [authentication, setAuthentication] = useState({
    suppliedToken: apiConfig.token,
    gatewayUrl,
    token: apiConfig.token,
  });
  const sameAuthentication = authentication.suppliedToken === apiConfig.token &&
    authentication.gatewayUrl === gatewayUrl;
  // Reset before committing effects so a new gateway never receives an old token.
  if (!sameAuthentication) {
    setAuthentication({ suppliedToken: apiConfig.token, gatewayUrl, token: apiConfig.token });
  }
  const token = sameAuthentication ? authentication.token : apiConfig.token;
  const [isLoadingNodes, setIsLoadingNodes] = useState(false);
  const [nodesError, setNodesError] = useState<string | null>(null);

  React.useEffect(() => {
    mounted.current = true;
    creationGeneration.current += 1;
    setConfigFile('');
    setShowQrCode(false);
    return () => {
      mounted.current = false;
      creationGeneration.current += 1;
    };
  }, [gatewayUrl, token]);

  const handleTokenReceived = (newToken: string) => {
    setAuthentication({ suppliedToken: apiConfig.token, gatewayUrl, token: newToken });
  };

  const generateKeys = () => {
    try {
      const randomBytesArray = new Uint8Array(32);
      crypto.getRandomValues(randomBytesArray);

      const keyPair = generateKeyPair(randomBytesArray);
      const privKey = Buffer.from(keyPair.private).toString('base64');
      const pubKey = Buffer.from(keyPair.public).toString('base64');

      const preSharedKeyArray = new Uint8Array(32);
      crypto.getRandomValues(preSharedKeyArray);
      const preSharedKeyB64 = Buffer.from(preSharedKeyArray).toString('base64');

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

  React.useEffect(() => {
    let active = true;
    setNodesData([]);
    setSelectedNodeId('');
    setSelectedNodeName('');
    if (!token) {
      setNodesError('Please authenticate first');
      setIsLoadingNodes(false);
      return;
    }
    const fetchNodesData = async () => {
      setIsLoadingNodes(true);
      setNodesError(null);
      try {
        const response = await axios.get(`${gatewayUrl}api/v1.0/nodes/all`, {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (!active) return;
        if (response.status === 200) {
          const payload: unknown = response.data?.payload;
          if (!Array.isArray(payload)) throw new Error('Invalid node list response');
          const filteredNodes = payload.filter(
            (node): node is Node =>
              node !== null && typeof node === 'object' &&
              typeof node.id === 'string' && !!node.id.trim() &&
              node.status === 'active' &&
              typeof node.region === 'string' && !!node.region.trim() &&
              (node.name === undefined || typeof node.name === 'string') &&
              (node.chainName === undefined || typeof node.chainName === 'string'),
          );
          setNodesData(filteredNodes);
        } else {
          setNodesError('Failed to fetch available nodes');
        }
      } catch (error) {
        if (!active) return;
        setNodesError('Failed to fetch available nodes');
        console.error('Error fetching nodes data:', error);
      } finally {
        if (active) setIsLoadingNodes(false);
      }
    };
    void fetchNodesData();
    return () => { active = false; };
  }, [gatewayUrl, token]);

  const createVPNClient = useCallback(async () => {
    if (creationInFlight.current || !mounted.current) return;
    if (!token) {
      Alert.alert('Error', 'Please authenticate first');
      return;
    }
    const selectedNode = nodesData.find((n) => n.id === selectedNodeId);
    if (!selectedNode) {
      Alert.alert('Error', 'Please select a node first');
      return;
    }
    const generation = creationGeneration.current;
    const isCurrent = () => mounted.current && generation === creationGeneration.current;
    creationInFlight.current = true;
    setIsCreatingClient(true);
    try {
      const keys = generateKeys();
      const requestData = {
        name: newClientName,
        presharedKey: keys.preSharedKey,
        publicKey: keys.pubKey,
      };
      const url = `${gatewayUrl}api/v1.0/erebrus/client/${selectedNodeId}`;
      console.log('Token used for client creation:', token);
      console.log('POST URL:', url);
      console.log('Request body:', requestData);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestData),
      });

      if (!isCurrent()) return;
      if (response.status === 200) {
        const data = await response.json();
        if (!isCurrent()) return;
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
          publicKey: data.payload.serverPublicKey,
          address: client.Address[0],
          serverAddress: data.payload.endpoint,
          serverPort: 51820,
          allowedIPs: ['0.0.0.0/0', '::/0'],
          dns: ['1.1.1.1', '8.8.8.8'],
          mtu: 1280,
          presharedKey: client.PresharedKey,
          persistentKeepalive: 16,
        };
        onClientCreated({ configFile, vpnConfig });
      } else {
        const errorText = await response.text();
        if (!isCurrent()) return;
        console.error('Failed to create VPN client:', errorText);
        Alert.alert('Error', `Failed to create VPN client: ${errorText}`);
      }
    } catch (error: any) {
      if (!isCurrent()) return;
      console.error('Failed to create VPN client:', error);
      let errorMessage = 'Failed to create VPN client: ';
      errorMessage += error.message || 'Unknown error occurred';
      Alert.alert('Error', errorMessage);
    } finally {
      creationInFlight.current = false;
      if (mounted.current) setIsCreatingClient(false);
    }
  }, [gatewayUrl, token, selectedNodeId, newClientName, nodesData, onClientCreated]);

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
              <ScrollView horizontal style={{ marginBottom: 16 }} showsHorizontalScrollIndicator={false}>
                {REGIONS.map((region) => (
                  <TouchableOpacity
                    key={region.id}
                    style={[
                      styles.regionButton,
                      {
                        backgroundColor: selectedRegion === region.id ? theme.primary : theme.background,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => {
                      setSelectedRegion(region.id);
                      setSelectedNodeId('');
                      setSelectedNodeName('');
                    }}
                  >
                    <Text style={{ color: selectedRegion === region.id ? '#fff' : theme.text }}>
                      {region.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.label, { color: theme.text }]}>Node</Text>
              {isLoadingNodes ? (
                <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 10 }} />
              ) : nodesError ? (
                <Text style={{ color: '#ef4444', marginBottom: 10 }}>{nodesError}</Text>
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.nodeSelectButton,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setShowNodeModal(true)}
                    disabled={!selectedRegion || nodesData.filter((n) => n.region === selectedRegion).length === 0}
                  >
                    <Text style={{ color: theme.text }}>
                      {selectedNodeName || 'Select Node'}
                    </Text>
                  </TouchableOpacity>
                  <Modal
                    visible={showNodeModal}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setShowNodeModal(false)}
                  >
                    <View style={styles.modalOverlay}>
                      <View style={[styles.modalContent, { backgroundColor: theme.surface }]}> 
                        <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 10 }]}>Select Node</Text>
                        <FlatList
                          data={nodesData.filter((node) => node.region === selectedRegion)}
                          keyExtractor={(item) => item.id}
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={[
                                styles.nodeItem,
                                {
                                  backgroundColor: selectedNodeId === item.id ? theme.primary : theme.background,
                                  borderColor: theme.border,
                                },
                              ]}
                              onPress={() => {
                                setSelectedNodeId(item.id);
                                setSelectedNodeName(`${item.name || item.id.slice(0, 8)} (${item.chainName})`);
                                setShowNodeModal(false);
                              }}
                            >
                              <Text style={{ color: selectedNodeId === item.id ? '#fff' : theme.text }}>
                                {item.name || item.id.slice(0, 8)} ({item.chainName})
                              </Text>
                            </TouchableOpacity>
                          )}
                          ListEmptyComponent={<Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 20 }}>No nodes available for this region.</Text>}
                          style={{ maxHeight: 300 }}
                        />
                        <TouchableOpacity
                          style={[styles.closeButton, { backgroundColor: theme.primary, marginTop: 20 }]}
                          onPress={() => setShowNodeModal(false)}
                        >
                          <Text style={{ color: '#fff' }}>Close</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Modal>
                </>
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
  regionButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 10,
    marginBottom: 8,
  },
  nodeSelectButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  nodeItem: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    alignItems: 'center',
  },
  closeButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
});
