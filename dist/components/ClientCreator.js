"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientCreator = void 0;
require("react-native-get-random-values");
const buffer_1 = require("buffer");
if (typeof global.Buffer === 'undefined') {
    global.Buffer = buffer_1.Buffer;
}
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const axios_1 = __importDefault(require("axios"));
const curve25519_js_1 = require("curve25519-js");
const react_native_qrcode_svg_1 = __importDefault(require("react-native-qrcode-svg"));
const Auth_1 = require("./Auth");
const REGIONS = [
    { id: "SG", name: "Singapore" },
    { id: "IN", name: "India" },
    { id: "US", name: "United States" },
    { id: "JP", name: "Japan" },
    { id: "CA", name: "Canada" },
    { id: "GB", name: "United Kingdom" },
    { id: "AU", name: "Australia" },
    { id: "DE", name: "Germany" },
];
const ClientCreator = ({ apiConfig, onClientCreated, theme = {
    surface: '#ffffff',
    background: '#f5f5f5',
    text: '#000000',
    textSecondary: '#6b7280',
    primary: '#6366f1',
    border: '#e5e7eb',
}, }) => {
    const [newClientName, setNewClientName] = (0, react_1.useState)('');
    const [selectedRegion, setSelectedRegion] = (0, react_1.useState)('');
    const [isCreatingClient, setIsCreatingClient] = (0, react_1.useState)(false);
    const [nodesData, setNodesData] = (0, react_1.useState)([]);
    const [selectedNodeId, setSelectedNodeId] = (0, react_1.useState)('');
    const [selectedNodeName, setSelectedNodeName] = (0, react_1.useState)('');
    const [showNodeModal, setShowNodeModal] = (0, react_1.useState)(false);
    const [showQrCode, setShowQrCode] = (0, react_1.useState)(false);
    const [configFile, setConfigFile] = (0, react_1.useState)('');
    const [token, setToken] = (0, react_1.useState)(apiConfig.token);
    const [isLoadingNodes, setIsLoadingNodes] = (0, react_1.useState)(false);
    const [nodesError, setNodesError] = (0, react_1.useState)(null);
    const handleTokenReceived = (newToken) => {
        setToken(newToken);
    };
    const generateKeys = () => {
        try {
            const randomBytesArray = new Uint8Array(32);
            crypto.getRandomValues(randomBytesArray);
            const keyPair = (0, curve25519_js_1.generateKeyPair)(randomBytesArray);
            const privKey = buffer_1.Buffer.from(keyPair.private).toString('base64');
            const pubKey = buffer_1.Buffer.from(keyPair.public).toString('base64');
            const preSharedKeyArray = new Uint8Array(32);
            crypto.getRandomValues(preSharedKeyArray);
            const preSharedKeyB64 = buffer_1.Buffer.from(preSharedKeyArray).toString('base64');
            return {
                preSharedKey: preSharedKeyB64,
                privKey,
                pubKey,
            };
        }
        catch (error) {
            console.error('Key generation failed:', error);
            throw new Error('Failed to generate cryptographic keys');
        }
    };
    const fetchNodesData = (0, react_1.useCallback)(async () => {
        if (!token) {
            setNodesError('Please authenticate first');
            return;
        }
        setIsLoadingNodes(true);
        setNodesError(null);
        try {
            const response = await axios_1.default.get(`${apiConfig.gatewayUrl}api/v1.0/nodes/all`, {
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.status === 200) {
                const payload = response.data.payload;
                const filteredNodes = payload.filter((node) => node.status === 'active' && node.region !== undefined && node.region !== null && node.region.trim());
                setNodesData(filteredNodes);
            }
            else {
                setNodesError('Failed to fetch available nodes');
            }
        }
        catch (error) {
            setNodesError('Failed to fetch available nodes');
            console.error('Error fetching nodes data:', error);
        }
        finally {
            setIsLoadingNodes(false);
        }
    }, [apiConfig, token]);
    react_1.default.useEffect(() => {
        fetchNodesData();
    }, [fetchNodesData]);
    const createVPNClient = (0, react_1.useCallback)(async () => {
        if (!token) {
            react_native_1.Alert.alert('Error', 'Please authenticate first');
            return;
        }
        const selectedNode = nodesData.find((n) => n.id === selectedNodeId);
        if (!selectedNode) {
            react_native_1.Alert.alert('Error', 'Please select a node first');
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
            const response = await axios_1.default.post(`${apiConfig.gatewayUrl}api/v1.0/erebrus/client/${selectedNode.id}`, requestData, {
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });
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
        }
        catch (error) {
            console.error('Failed to create VPN client:', error);
            let errorMessage = 'Failed to create VPN client: ';
            if (error.response?.data?.message) {
                errorMessage += error.response.data.message;
            }
            else if (error.response?.data?.error) {
                errorMessage += error.response.data.error;
            }
            else {
                errorMessage += error.message || 'Unknown error occurred';
            }
            react_native_1.Alert.alert('Error', errorMessage);
        }
        finally {
            setIsCreatingClient(false);
        }
    }, [apiConfig, token, selectedNodeId, newClientName, nodesData, onClientCreated]);
    return (<react_native_1.ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {!token ? (<Auth_1.Auth onTokenReceived={handleTokenReceived}/>) : (<>
          <react_native_1.View style={[styles.section, { backgroundColor: theme.surface }]}>
            <react_native_1.Text style={[styles.sectionTitle, { color: theme.text }]}>Create New Client</react_native_1.Text>
            <react_native_1.View style={styles.form}>
              <react_native_1.Text style={[styles.label, { color: theme.text }]}>Client Name</react_native_1.Text>
              <react_native_1.TextInput style={[
                styles.input,
                {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text,
                },
            ]} value={newClientName} onChangeText={setNewClientName} placeholder="Enter client name (max 8 chars)" placeholderTextColor={theme.textSecondary} maxLength={8}/>

              <react_native_1.Text style={[styles.label, { color: theme.text }]}>Region</react_native_1.Text>
              <react_native_1.ScrollView horizontal style={{ marginBottom: 16 }} showsHorizontalScrollIndicator={false}>
                {REGIONS.map((region) => (<react_native_1.TouchableOpacity key={region.id} style={[
                    styles.regionButton,
                    {
                        backgroundColor: selectedRegion === region.id ? theme.primary : theme.background,
                        borderColor: theme.border,
                    },
                ]} onPress={() => {
                    setSelectedRegion(region.id);
                    setSelectedNodeId('');
                    setSelectedNodeName('');
                }}>
                    <react_native_1.Text style={{ color: selectedRegion === region.id ? '#fff' : theme.text }}>
                      {region.name}
                    </react_native_1.Text>
                  </react_native_1.TouchableOpacity>))}
              </react_native_1.ScrollView>

              <react_native_1.Text style={[styles.label, { color: theme.text }]}>Node</react_native_1.Text>
              {isLoadingNodes ? (<react_native_1.ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 10 }}/>) : nodesError ? (<react_native_1.Text style={{ color: '#ef4444', marginBottom: 10 }}>{nodesError}</react_native_1.Text>) : (<>
                  <react_native_1.TouchableOpacity style={[
                    styles.nodeSelectButton,
                    {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                    },
                ]} onPress={() => setShowNodeModal(true)} disabled={!selectedRegion || nodesData.filter((n) => n.region === selectedRegion).length === 0}>
                    <react_native_1.Text style={{ color: theme.text }}>
                      {selectedNodeName || 'Select Node'}
                    </react_native_1.Text>
                  </react_native_1.TouchableOpacity>
                  <react_native_1.Modal visible={showNodeModal} animationType="slide" transparent={true} onRequestClose={() => setShowNodeModal(false)}>
                    <react_native_1.View style={styles.modalOverlay}>
                      <react_native_1.View style={[styles.modalContent, { backgroundColor: theme.surface }]}> 
                        <react_native_1.Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 10 }]}>Select Node</react_native_1.Text>
                        <react_native_1.FlatList data={nodesData.filter((node) => node.region === selectedRegion)} keyExtractor={(item) => item.id} renderItem={({ item }) => (<react_native_1.TouchableOpacity style={[
                        styles.nodeItem,
                        {
                            backgroundColor: selectedNodeId === item.id ? theme.primary : theme.background,
                            borderColor: theme.border,
                        },
                    ]} onPress={() => {
                        setSelectedNodeId(item.id);
                        setSelectedNodeName(`${item.name || item.id.slice(0, 8)} (${item.chainName})`);
                        setShowNodeModal(false);
                    }}>
                              <react_native_1.Text style={{ color: selectedNodeId === item.id ? '#fff' : theme.text }}>
                                {item.name || item.id.slice(0, 8)} ({item.chainName})
                              </react_native_1.Text>
                            </react_native_1.TouchableOpacity>)} ListEmptyComponent={<react_native_1.Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 20 }}>No nodes available for this region.</react_native_1.Text>} style={{ maxHeight: 300 }}/>
                        <react_native_1.TouchableOpacity style={[styles.closeButton, { backgroundColor: theme.primary, marginTop: 20 }]} onPress={() => setShowNodeModal(false)}>
                          <react_native_1.Text style={{ color: '#fff' }}>Close</react_native_1.Text>
                        </react_native_1.TouchableOpacity>
                      </react_native_1.View>
                    </react_native_1.View>
                  </react_native_1.Modal>
                </>)}

              <react_native_1.TouchableOpacity style={[
                styles.createButton,
                {
                    backgroundColor: theme.primary,
                    opacity: !newClientName || !selectedRegion || !selectedNodeId || isCreatingClient ? 0.5 : 1,
                },
            ]} onPress={createVPNClient} disabled={!newClientName || !selectedRegion || !selectedNodeId || isCreatingClient}>
                {isCreatingClient ? (<react_native_1.ActivityIndicator color="#ffffff" size="small"/>) : (<react_native_1.Text style={styles.createButtonText}>Create Client</react_native_1.Text>)}
              </react_native_1.TouchableOpacity>
            </react_native_1.View>

            {showQrCode && configFile && (<react_native_1.View style={styles.qrCodeContainer}>
                <react_native_qrcode_svg_1.default value={configFile} size={200} backgroundColor={theme.surface} color={theme.text}/>
                <react_native_1.Text style={[styles.qrCodeText, { color: theme.textSecondary }]}>
                  Scan this QR code with the WireGuard app
                </react_native_1.Text>
              </react_native_1.View>)}
          </react_native_1.View>
        </>)}
    </react_native_1.ScrollView>);
};
exports.ClientCreator = ClientCreator;
const styles = react_native_1.StyleSheet.create({
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
