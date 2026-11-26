"use client"

import React, { useState, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  Modal,
} from "react-native"
import 'react-native-get-random-values'
import QRCode from "react-native-qrcode-svg"
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
  gatewayUrl: "https://gateway.dev.netsepio.com/",
}

// Main VPN Screen Component
const VPNScreen = () => {
  const isDarkMode = useColorScheme() === 'dark'
  const { vpnStatus, isConnecting, isDisconnecting, connectVPN, disconnectVPN } = useVPN()
  const [showCreateModal, setShowCreateModal] = useState(false)
  // const [showQrCodeModal, setShowQrCodeModal] = useState(false)
  const [currentConfig, setCurrentConfig] = useState<VPNConfig | null>(null)
  const [configFile, setConfigFile] = useState<string>("")
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
    setConfigFile(configFile)
    // setShowQrCodeModal(true)
    setCurrentConfig(vpnConfig)
    setShowCreateModal(false)
  }

  const handleConnect = useCallback(() => {
    if (currentConfig) {
      connectVPN(currentConfig)
    }
  }, [currentConfig, connectVPN])

  const handleDisconnect = useCallback(() => {
    disconnectVPN()
  }, [disconnectVPN])

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
              disabled={!token}
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

      {/* {showQrCodeModal && configFile && (
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
      )} */}
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
