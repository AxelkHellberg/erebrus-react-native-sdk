"use client"

import React, { useEffect, useState, useCallback, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  useColorScheme,
  Modal,
  TextInput,
  Animated,
} from "react-native"
import WireGuardVpnModule, { type WireGuardStatus } from "react-native-wireguard-vpn-connect"
import 'react-native-get-random-values'
import { Buffer } from 'buffer'
import { generateKeyPair } from 'curve25519-js'
import CryptoJS from "crypto-js"  
import { randomBytes } from 'react-native-get-random-values'
import QRCode from "react-native-qrcode-svg"
import axios from "axios"
import {
  VPNProvider,
  ConnectionButton,
  ClientCreator,
  StatusCard,
  useVPN,
  defaultTheme,
  type VPNConfig,
  Auth,
} from 'erebrus-react-native-sdk'

interface WireGuardConfig {
  privateKey: string
  publicKey: string
  serverAddress: string
  serverPort: number
  allowedIPs: string[]
  dns?: string[]
  mtu?: number
  presharedKey?: string
  persistentKeepalive?: number
}

interface Node {
  id: string
  name: string
  httpPort: string
  domain: string
  nodename: string
  chainName: string
  address: string
  region: string
  status: string
  downloadSpeed: number
  uploadSpeed: number
  startTimeStamp: number
  lastPingedTimeStamp: number
  walletAddress: string
  walletAddressSol: string
  ipinfoip: string
  ipinfocity: string
  ipinfocountry: string
  ipinfolocation: string
  ipinfoorg: string
  ipinfopostal: string
  ipinfotimezone: string
  totalUptime: number
  upTimeUnit: string
  nodeType: string
  nodeConfig: string
}

interface Region {
  id: string;
  name: string;
}

// Available regions
const REGIONS: Region[] = [
  { id: "SG", name: "Singapore" },
  { id: "IN", name: "India" },
  { id: "US", name: "United States" },
  { id: "JP", name: "Japan" },
  { id: "CA", name: "Canada" },
  { id: "GB", name: "United Kingdom" },
  { id: "AU", name: "Australia" },
  { id: "DE", name: "Germany" },
]

// API Configuration
const API_CONFIG = {
  gatewayUrl: "https://gateway.erebrus.io/",
}

// Main VPN Screen Component
const VPNScreen = () => {
  const isDarkMode = useColorScheme() === 'dark'
  const { vpnStatus, isConnecting, isDisconnecting, connectVPN, disconnectVPN } = useVPN()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showQrCodeModal, setShowQrCodeModal] = useState(false)
  const [isCreatingClient, setIsCreatingClient] = useState(false)
  const [currentConfig, setCurrentConfig] = useState<WireGuardConfig | null>(null)
  const [newClientName, setNewClientName] = useState("")
  const [selectedRegion, setSelectedRegion] = useState("")
  const [configFile, setConfigFile] = useState<string>("")
  const [nodesData, setNodesData] = useState<Node[]>([])
  const [activeNodesData, setActiveNodesData] = useState<Node[]>([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [isNodeDropdownOpen, setIsNodeDropdownOpen] = useState(false)
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(null)
  const [token, setToken] = useState<string>("")

  // Custom theme based on dark/light mode
  const theme = {
    ...defaultTheme,
    background: isDarkMode ? '#121212' : '#f5f5f5',
    surface: isDarkMode ? '#1e1e1e' : '#ffffff',
    text: isDarkMode ? '#ffffff' : '#000000',
    textSecondary: isDarkMode ? '#a1a1aa' : '#6b7280',
    border: isDarkMode ? '#374151' : '#e5e7eb',
  }

  const handleClientCreated = ({ configFile, vpnConfig }: { configFile: string; vpnConfig: VPNConfig }) => {
    console.log('New client created:', configFile)
    setConfigFile(configFile)
    setShowQrCodeModal(true)
    setCurrentConfig(vpnConfig)
    setShowCreateModal(false)
  }

  const generateKeys = () => {
    try {
      // Generate pre-shared key using crypto-js
      const preSharedKey = CryptoJS.lib.WordArray.random(32)
      const preSharedKeyB64 = preSharedKey.toString(CryptoJS.enc.Base64)

      // Generate key pair using curve25519-js
      const randomBytes = CryptoJS.lib.WordArray.random(32)
      const randomBytesArray = new Uint8Array(randomBytes.words.length * 4)
      for (let i = 0; i < randomBytes.words.length; i++) {
        const word = randomBytes.words[i]
        randomBytesArray[i * 4] = (word >>> 24) & 0xff
        randomBytesArray[i * 4 + 1] = (word >>> 16) & 0xff
        randomBytesArray[i * 4 + 2] = (word >>> 8) & 0xff
        randomBytesArray[i * 4 + 3] = word & 0xff
      }

      const keyPair = generateKeyPair(randomBytesArray)
      const privKey = Buffer.from(keyPair.private).toString("base64")
      const pubKey = Buffer.from(keyPair.public).toString("base64")

      return {
        preSharedKey: preSharedKeyB64,
        privKey: privKey,
        pubKey: pubKey,
      }
    } catch (error) {
      console.error("Key generation failed:", error)
      throw new Error("Failed to generate cryptographic keys")
    }
  }

  const createVPNClient = useCallback(async (name: string, region: string) => {
    if (!selectedNode) {
      Alert.alert("Error", "Please select a node first")
      return
    }

    setIsCreatingClient(true)
    try {
      // Log all relevant data
      console.log("Selected Node:", {
        id: selectedNode.id,
        name: selectedNode.name,
        region: selectedNode.region,
        status: selectedNode.status,
        chainName: selectedNode.chainName
      })
      console.log("Selected Region:", region)
      console.log("Client Name:", name)

      const keys = generateKeys()

      // Create request payload
      const requestData = {
        name: name,
        presharedKey: keys.preSharedKey,
        publicKey: keys.pubKey
      }

      console.log("Request payload:", requestData)
      console.log("Request URL:", `${API_CONFIG.gatewayUrl}api/v1.0/erebrus/client/${selectedNode.id}`)
      console.log("Request headers:", {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      })

      const response = await axios.post(
        `${API_CONFIG.gatewayUrl}api/v1.0/erebrus/client/${selectedNode.id}`,
        requestData,
        {
          headers: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (response.status === 200) {
        const data = response.data
        console.log("Client created successfully:", data)

        const client = data.payload.client
        // Construct WireGuard configuration string
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
PersistentKeepalive = 16`

        setConfigFile(configFile)
        setShowQrCodeModal(true)

        // Construct WireGuardConfig for native module
        const config: WireGuardConfig = {
          privateKey: keys.privKey,
          publicKey: keys.pubKey,
          serverAddress: data.payload.endpoint,
          serverPort: 51820,
          allowedIPs: ["0.0.0.0/0", "::/0"],
          dns: ["1.1.1.1", "8.8.8.8"],
          mtu: 1280,
          presharedKey: client.PresharedKey,
          persistentKeepalive: 16,
        }

        setCurrentConfig(config)
        Alert.alert("Success", `VPN client "${name}" created successfully! You can now connect.`)
        setShowCreateModal(false)
        setNewClientName("")
        setSelectedRegion("")
        setSelectedNode(null)
        setSelectedNodeIndex(null)
      }
    } catch (error: any) {
      console.error("Failed to create VPN client:", error)
      
      // Enhanced error logging
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error("Error response data:", error.response.data)
        console.error("Error response status:", error.response.status)
        console.error("Error response headers:", error.response.headers)
        
        let errorMessage = "Failed to create VPN client: "
        if (error.response.data && error.response.data.message) {
          errorMessage += error.response.data.message
        } else if (error.response.data && error.response.data.error) {
          errorMessage += error.response.data.error
        } else {
          errorMessage += `Server responded with status ${error.response.status}`
        }
        Alert.alert("Error", errorMessage)
      } else if (error.request) {
        // The request was made but no response was received
        console.error("Error request:", error.request)
        Alert.alert("Error", "No response received from server. Please check your internet connection.")
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error("Error message:", error.message)
        Alert.alert("Error", "Failed to create VPN client: " + error.message)
      }
    } finally {
      setIsCreatingClient(false)
    }
  }, [selectedNode, token])

  const fetchNodesData = async () => {
    try {
      const response = await axios.get(`${API_CONFIG.gatewayUrl}api/v1.0/nodes/all`, {
        headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.status === 200) {
        const payload = response.data.payload
        setNodesData(payload)

        // Filter only active nodes
        const filteredNodes = payload.filter(
          (node: Node) =>
            node.status === "active" && node.region !== undefined && node.region !== null && node.region.trim(),
        )
        setActiveNodesData(filteredNodes)
        console.log("Active nodes:", filteredNodes)
      }
    } catch (error) {
      console.error("Error fetching nodes data:", error)
    }
  }

  // Helper functions for node selection
  const generateSerialNumber = (region: string, index: number) => {
    return `${region}-${(index + 1).toString().padStart(3, '0')}`
  }

  const sliceNodeId = (id: string) => {
    return id.substring(0, 8) + '...' + id.substring(id.length - 4)
  }

  const sliceWalletAddress = (address: string) => {
    if (!address) return "N/A"
    return address.substring(0, 6) + '...' + address.substring(address.length - 4)
  }

  useEffect(() => {
    fetchNodesData()
  }, [token])

  const handleConnect = useCallback(() => {
    if (currentConfig) {
      connectVPN(currentConfig);
    }
  }, [currentConfig, connectVPN]);

  const handleDisconnect = useCallback(() => {
    disconnectVPN();
  }, [disconnectVPN]);

  console.log('Current token:', token); // Debug log

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Erebrus VPN</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>WireGuard Protocol</Text>
        </View>

        <View style={styles.authSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Authentication</Text>
          <Auth onTokenReceived={setToken} />
        </View>

        <View style={styles.vpnSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>VPN Status</Text>
          <StatusCard vpnStatus={vpnStatus} theme={theme} />

          <View style={styles.actions}>
            <ConnectionButton
              isConnected={vpnStatus?.isConnected || false}
              isConnecting={isConnecting}
              isDisconnecting={isDisconnecting}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              theme={theme}
            />
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowCreateModal(true)}
            >
              <Text style={styles.createButtonText}>Create New Client</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {showCreateModal && (
        <Modal
          visible={showCreateModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowCreateModal(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
            <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
              <ClientCreator
                apiConfig={{
                  token,
                  gatewayUrl: API_CONFIG.gatewayUrl,
                }}
                onClientCreated={handleClientCreated}
                theme={theme}
              />
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: theme.primary }]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {showQrCodeModal && configFile && (
        <Modal
          visible={showQrCodeModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowQrCodeModal(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
            <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
              <View style={styles.qrCodeContainer}>
                <QRCode value={configFile} size={200} backgroundColor={theme.surface} color={theme.text} />
                <Text style={[styles.qrCodeText, { color: theme.textSecondary }]}>
                  Scan this QR code with the WireGuard app
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: theme.primary }]}
                onPress={() => setShowQrCodeModal(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

// Root App Component
const App = () => {
  return (
    <VPNProvider>
      <VPNScreen />
    </VPNProvider>
  )
}

interface StatusRowProps {
  label: string
  value: string
  valueColor?: string
  theme: any
}

const StatusRow: React.FC<StatusRowProps> = ({ label, value, valueColor, theme }) => (
  <View style={styles.statusRow}>
    <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>{label}:</Text>
    <Text style={[styles.statusValue, { color: valueColor || theme.text }]}>{value}</Text>
  </View>
)

interface ActionButtonProps {
  title: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  style?: any
  textStyle?: any
}

const ActionButton: React.FC<ActionButtonProps> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => (
  <TouchableOpacity
    style={[styles.actionButton, style, disabled && styles.disabledButton]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
  >
    {loading ? (
      <ActivityIndicator color="#ffffff" size="small" />
    ) : (
      <Text style={[styles.actionButtonText, textStyle]}>{title}</Text>
    )}
  </TouchableOpacity>
)

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  authSection: {
    marginBottom: 30,
  },
  vpnSection: {
    marginBottom: 30,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  createButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  closeButton: {
    marginTop: 20,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  qrCodeContainer: {
    alignItems: 'center',
    padding: 20,
  },
  qrCodeText: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
  },
})

export default App