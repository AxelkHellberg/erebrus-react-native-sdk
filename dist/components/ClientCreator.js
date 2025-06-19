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
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const axios_1 = __importDefault(require("axios"));
const crypto_js_1 = __importDefault(require("crypto-js"));
const curve25519_js_1 = require("curve25519-js");
const react_native_qrcode_svg_1 = __importDefault(require("react-native-qrcode-svg"));
const Auth_1 = require("./Auth");
// @ts-ignore
const picker_1 = require("@react-native-picker/picker");
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
            const preSharedKey = crypto_js_1.default.lib.WordArray.random(32);
            const preSharedKeyB64 = preSharedKey.toString(crypto_js_1.default.enc.Base64);
            const randomBytes = crypto_js_1.default.lib.WordArray.random(32);
            const randomBytesArray = new Uint8Array(randomBytes.words.length * 4);
            for (let i = 0; i < randomBytes.words.length; i++) {
                const word = randomBytes.words[i];
                randomBytesArray[i * 4] = (word >>> 24) & 0xff;
                randomBytesArray[i * 4 + 1] = (word >>> 16) & 0xff;
                randomBytesArray[i * 4 + 2] = (word >>> 8) & 0xff;
                randomBytesArray[i * 4 + 3] = word & 0xff;
            }
            const keyPair = (0, curve25519_js_1.generateKeyPair)(randomBytesArray);
            const privKey = Buffer.from(keyPair.private).toString('base64');
            const pubKey = Buffer.from(keyPair.public).toString('base64');
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
              <react_native_1.View style={styles.pickerWrapper}>
                <picker_1.Picker selectedValue={selectedRegion} onValueChange={(itemValue) => {
                setSelectedRegion(itemValue);
                setSelectedNodeId('');
            }} style={{ color: theme.text }}>
                  <picker_1.Picker.Item label="Select a region" value=""/>
                  {REGIONS.map((region) => (<picker_1.Picker.Item key={region.id} label={region.name} value={region.id}/>))}
                </picker_1.Picker>
              </react_native_1.View>

              <react_native_1.Text style={[styles.label, { color: theme.text }]}>Node</react_native_1.Text>
              {isLoadingNodes ? (<react_native_1.ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 10 }}/>) : nodesError ? (<react_native_1.Text style={{ color: '#ef4444', marginBottom: 10 }}>{nodesError}</react_native_1.Text>) : (<react_native_1.View style={styles.pickerWrapper}>
                  <picker_1.Picker enabled={!!selectedRegion && nodesData.filter((n) => n.region === selectedRegion).length > 0} selectedValue={selectedNodeId} onValueChange={(itemValue) => {
                    setSelectedNodeId(itemValue);
                }} style={{ color: theme.text }}>
                    <picker_1.Picker.Item label="Select a node" value=""/>
                    {nodesData
                    .filter((node) => node.region === selectedRegion)
                    .map((node) => (<picker_1.Picker.Item key={node.id} label={`${node.name || node.id.slice(0, 8)} (${node.chainName})`} value={node.id}/>))}
                  </picker_1.Picker>
                </react_native_1.View>)}

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
});
