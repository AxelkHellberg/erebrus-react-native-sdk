"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusCard = void 0;
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
const StatusRow = ({ label, value, valueColor, theme }) => (<react_native_1.View style={styles.statusRow}>
    <react_native_1.Text style={[styles.statusLabel, { color: theme.textSecondary }]}>{label}:</react_native_1.Text>
    <react_native_1.Text style={[styles.statusValue, { color: valueColor || theme.text }]}>{value}</react_native_1.Text>
  </react_native_1.View>);
const StatusCard = ({ vpnStatus, theme = {
    surface: '#ffffff',
    border: '#e5e7eb',
    text: '#000000',
    textSecondary: '#6b7280',
    success: '#10b981',
    error: '#ef4444',
}, }) => {
    const isConnected = vpnStatus?.isConnected;
    const statusColor = isConnected ? theme.success : theme.error;
    const statusText = isConnected ? 'Connected' : 'Disconnected';
    return (<react_native_1.View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <react_native_1.View style={styles.header}>
        <react_native_1.View style={[styles.statusDot, { backgroundColor: statusColor }]}/>
        <react_native_1.Text style={[styles.title, { color: theme.text }]}>VPN Status</react_native_1.Text>
      </react_native_1.View>

      <react_native_1.View style={styles.details}>
        <StatusRow label="Connection" value={statusText} valueColor={statusColor} theme={theme}/>
        <StatusRow label="State" value={vpnStatus?.tunnelState || 'Unknown'} theme={theme}/>
        {vpnStatus?.error && (<StatusRow label="Error" value={vpnStatus.error} valueColor={theme.error} theme={theme}/>)}
      </react_native_1.View>
    </react_native_1.View>);
};
exports.StatusCard = StatusCard;
const styles = react_native_1.StyleSheet.create({
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
