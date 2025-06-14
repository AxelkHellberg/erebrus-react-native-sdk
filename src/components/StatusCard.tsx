import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { type WireGuardStatus } from 'react-native-wireguard-vpn';

interface StatusCardProps {
  vpnStatus: WireGuardStatus | null;
  theme?: {
    surface: string;
    border: string;
    text: string;
    textSecondary: string;
    success: string;
    error: string;
  };
}

interface StatusRowProps {
  label: string;
  value: string;
  valueColor?: string;
  theme: {
    text: string;
    textSecondary: string;
  };
}

const StatusRow: React.FC<StatusRowProps> = ({ label, value, valueColor, theme }) => (
  <View style={styles.statusRow}>
    <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>{label}:</Text>
    <Text style={[styles.statusValue, { color: valueColor || theme.text }]}>{value}</Text>
  </View>
);

export const StatusCard: React.FC<StatusCardProps> = ({
  vpnStatus,
  theme = {
    surface: '#ffffff',
    border: '#e5e7eb',
    text: '#000000',
    textSecondary: '#6b7280',
    success: '#10b981',
    error: '#ef4444',
  },
}) => {
  const isConnected = vpnStatus?.isConnected;
  const statusColor = isConnected ? theme.success : theme.error;
  const statusText = isConnected ? 'Connected' : 'Disconnected';

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.title, { color: theme.text }]}>VPN Status</Text>
      </View>

      <View style={styles.details}>
        <StatusRow label="Connection" value={statusText} valueColor={statusColor} theme={theme} />
        <StatusRow label="State" value={vpnStatus?.tunnelState || 'Unknown'} theme={theme} />
        {vpnStatus?.error && (
          <StatusRow label="Error" value={vpnStatus.error} valueColor={theme.error} theme={theme} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  details: {
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
}); 