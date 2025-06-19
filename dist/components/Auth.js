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
    const [errorMsg, setErrorMsg] = (0, react_1.useState)(null);
    const handleAuth = async () => {
        setIsLoading(true);
        setStatus('idle');
        setErrorMsg(null);
        try {
            // Step 1: Create organization
            const orgRes = await fetch('https://gateway.dev.netsepio.com/api/v1.1/organisation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const orgData = await orgRes.json();
            if (!orgRes.ok) {
                const msg = orgData?.message || 'Failed to create organization';
                setErrorMsg(msg);
                setStatus('error');
                console.error('Org creation error:', orgData);
                return;
            }
            const apiKey = orgData.api_key;
            if (!apiKey) {
                setErrorMsg('No API key returned');
                setStatus('error');
                console.error('No API key in orgData:', orgData);
                return;
            }
            // Step 2: Get token
            const tokenRes = await fetch('https://gateway.dev.netsepio.com/api/v1.1/organisation/token', {
                method: 'GET',
                headers: { 'X-API-Key': apiKey },
            });
            const tokenData = await tokenRes.json();
            if (!tokenRes.ok) {
                const msg = tokenData?.message || 'Failed to generate token';
                setErrorMsg(msg);
                setStatus('error');
                console.error('Token generation error:', tokenData);
                return;
            }
            const token = tokenData?.payload?.token || tokenData?.payload?.Token;
            if (!token) {
                setErrorMsg('No token returned');
                setStatus('error');
                console.error('No token in tokenData:', tokenData);
                return;
            }
            setStatus('success');
            onTokenReceived(token);
        }
        catch (e) {
            setErrorMsg(e?.message || 'Unknown error');
            setStatus('error');
            console.error('Auth error:', e);
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
      {status === 'error' && (<react_native_1.Text style={styles.error}>{errorMsg || 'Something went wrong. Try again.'}</react_native_1.Text>)}
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
