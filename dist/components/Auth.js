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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Auth = void 0;
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const Auth = ({ onTokenReceived }) => {
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [status, setStatus] = (0, react_1.useState)('idle');
    const handleAuth = async () => {
        setIsLoading(true);
        setStatus('idle');
        try {
            // Step 1: Create organization
            const orgRes = await fetch('https://gateway.dev.netsepio.com/api/v1.1/organisation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!orgRes.ok)
                throw new Error('Failed to create organization');
            const orgData = await orgRes.json();
            const apiKey = orgData.api_key;
            if (!apiKey)
                throw new Error('No API key returned');
            // Step 2: Get token
            const tokenRes = await fetch('https://gateway.dev.netsepio.com/api/v1.1/organisation/token', {
                method: 'GET',
                headers: { 'X-API-Key': apiKey },
            });
            if (!tokenRes.ok)
                throw new Error('Failed to generate token');
            const tokenData = await tokenRes.json();
            const token = tokenData?.payload?.Token;
            if (!token)
                throw new Error('No token returned');
            setStatus('success');
            onTokenReceived(token);
        }
        catch (e) {
            setStatus('error');
        }
        finally {
            setIsLoading(false);
        }
    };
    return (<react_native_1.View style={styles.container}>
      <react_native_1.TouchableOpacity style={styles.button} onPress={handleAuth} disabled={isLoading}>
        {isLoading ? (<react_native_1.ActivityIndicator color="#fff"/>) : (<react_native_1.Text style={styles.buttonText}>Create Organization & Get Token</react_native_1.Text>)}
      </react_native_1.TouchableOpacity>
      {status === 'success' && <react_native_1.Text style={styles.success}>Token generated!</react_native_1.Text>}
      {status === 'error' && <react_native_1.Text style={styles.error}>Something went wrong. Try again.</react_native_1.Text>}
    </react_native_1.View>);
};
exports.Auth = Auth;
const styles = react_native_1.StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    button: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 8,
        minWidth: 220,
        alignItems: 'center',
        marginBottom: 16,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    success: {
        color: '#10b981',
        fontSize: 16,
        marginTop: 8,
    },
    error: {
        color: '#ef4444',
        fontSize: 16,
        marginTop: 8,
    },
});
