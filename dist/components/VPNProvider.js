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
exports.VPNProvider = exports.useVPN = void 0;
const react_1 = __importStar(require("react"));
const react_native_wireguard_vpn_connect_1 = __importDefault(require("react-native-wireguard-vpn-connect"));
const react_native_1 = require("react-native");
const VPNContext = (0, react_1.createContext)(undefined);
const useVPN = () => {
    const context = (0, react_1.useContext)(VPNContext);
    if (!context) {
        throw new Error('useVPN must be used within a VPNProvider');
    }
    return context;
};
exports.useVPN = useVPN;
function isVPNStatus(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
    const status = value;
    // Native iOS uses state names beyond the TypeScript union. Keep those strings.
    return typeof status.isConnected === 'boolean' &&
        (status.tunnelState === undefined || typeof status.tunnelState === 'string') &&
        (status.error === undefined || typeof status.error === 'string') &&
        (status.vpnPermissionGranted === undefined || typeof status.vpnPermissionGranted === 'boolean');
}
const VPNProvider = ({ children }) => {
    const [vpnStatus, setVpnStatus] = (0, react_1.useState)(null);
    const [isConnecting, setIsConnecting] = (0, react_1.useState)(false);
    const [isDisconnecting, setIsDisconnecting] = (0, react_1.useState)(false);
    const [isInitialized, setIsInitialized] = (0, react_1.useState)(false);
    const mounted = (0, react_1.useRef)(false);
    const lifecycle = (0, react_1.useRef)(0);
    const statusRequest = (0, react_1.useRef)(0);
    const operation = (0, react_1.useRef)(null);
    const updateStatus = (0, react_1.useCallback)(async () => {
        if (!mounted.current)
            return;
        const request = ++statusRequest.current;
        try {
            const nativeStatus = await react_native_wireguard_vpn_connect_1.default.getStatus();
            // Android can return a null error when an exception has no message.
            const status = nativeStatus?.error === null ? { ...nativeStatus, error: undefined } : nativeStatus;
            if (!isVPNStatus(status))
                throw new Error('Invalid native VPN status');
            if (mounted.current && request === statusRequest.current)
                setVpnStatus(status);
        }
        catch (error) {
            if (mounted.current && request === statusRequest.current) {
                console.error("Failed to get VPN status:", error);
            }
        }
    }, []);
    const connectVPN = (0, react_1.useCallback)(async (config) => {
        if (!mounted.current || operation.current !== null || !isInitialized) {
            return;
        }
        const generation = lifecycle.current;
        const isCurrent = () => mounted.current && lifecycle.current === generation;
        operation.current = 'connect';
        setIsConnecting(true);
        try {
            if (!config.privateKey || !config.publicKey) {
                throw new Error("Invalid cryptographic keys");
            }
            await react_native_wireguard_vpn_connect_1.default.connect(config);
            if (isCurrent())
                await updateStatus();
        }
        catch (error) {
            if (!isCurrent())
                return;
            console.error("Connection failed:", error);
            let errorMessage = error.message || "Unknown error occurred";
            if (errorMessage.includes("KeyFormat")) {
                errorMessage = "Invalid key format";
            }
            else if (errorMessage.includes("timeout")) {
                errorMessage = "Connection timeout";
            }
            react_native_1.Alert.alert("Connection Failed", errorMessage);
        }
        finally {
            operation.current = null;
            if (isCurrent())
                setIsConnecting(false);
        }
    }, [isInitialized, updateStatus]);
    const disconnectVPN = (0, react_1.useCallback)(async () => {
        if (!mounted.current || operation.current !== null)
            return;
        const generation = lifecycle.current;
        const isCurrent = () => mounted.current && lifecycle.current === generation;
        operation.current = 'disconnect';
        setIsDisconnecting(true);
        try {
            await react_native_wireguard_vpn_connect_1.default.disconnect();
            if (isCurrent())
                await updateStatus();
        }
        catch (error) {
            if (!isCurrent())
                return;
            console.error("Disconnection failed:", error);
            react_native_1.Alert.alert("Disconnection Failed", error.message || "Unknown error occurred");
        }
        finally {
            operation.current = null;
            if (isCurrent())
                setIsDisconnecting(false);
        }
    }, [updateStatus]);
    (0, react_1.useEffect)(() => {
        mounted.current = true;
        const generation = ++lifecycle.current;
        const isCurrent = () => mounted.current && lifecycle.current === generation;
        const initializeVPN = async () => {
            try {
                await react_native_wireguard_vpn_connect_1.default.initialize();
                if (!isCurrent())
                    return;
                setIsInitialized(true);
                await updateStatus();
            }
            catch (error) {
                if (!isCurrent())
                    return;
                console.error("VPN initialization failed:", error);
                react_native_1.Alert.alert("Initialization Error", error.message || "Unknown error occurred");
            }
        };
        void initializeVPN();
        return () => {
            mounted.current = false;
            lifecycle.current += 1;
            statusRequest.current += 1;
        };
    }, [updateStatus]);
    const value = {
        vpnStatus,
        isConnecting,
        isDisconnecting,
        isInitialized,
        connectVPN,
        disconnectVPN,
        updateStatus,
    };
    return <VPNContext.Provider value={value}>{children}</VPNContext.Provider>;
};
exports.VPNProvider = VPNProvider;
