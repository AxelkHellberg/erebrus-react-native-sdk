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
exports.ConnectionButton = void 0;
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const ConnectionButton = ({ isConnected, isConnecting, isDisconnecting, onConnect, onDisconnect, theme = {
    success: '#10b981',
    error: '#ef4444',
    textSecondary: '#6b7280',
}, }) => {
    const scaleAnim = (0, react_1.useRef)(new react_native_1.Animated.Value(1)).current;
    const handlePress = () => {
        react_native_1.Animated.sequence([
            react_native_1.Animated.timing(scaleAnim, {
                toValue: 0.95,
                duration: 100,
                useNativeDriver: true,
            }),
            react_native_1.Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();
        if (isConnected) {
            onDisconnect();
        }
        else {
            onConnect();
        }
    };
    return (<react_native_1.View style={styles.container}>
      <react_native_1.Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <react_native_1.TouchableOpacity style={[
            styles.button,
            {
                backgroundColor: isConnected ? theme.error : theme.success,
                borderWidth: 4,
                borderColor: isConnected ? theme.error : theme.success,
            },
        ]} onPress={handlePress} disabled={isConnecting || isDisconnecting}>
          {(isConnecting || isDisconnecting) ? (<react_native_1.ActivityIndicator color="#ffffff" size="large"/>) : (<>
              <react_native_1.Text style={styles.buttonText}>
                {isConnected ? "Disconnect" : "Connect"}
              </react_native_1.Text>
              <react_native_1.Text style={styles.buttonSubtext}>
                {isConnected ? "Tap to disconnect" : "Tap to connect"}
              </react_native_1.Text>
            </>)}
        </react_native_1.TouchableOpacity>
      </react_native_1.Animated.View>
      <react_native_1.Text style={[styles.status, { color: theme.textSecondary }]}>
        {isConnected ? "Your connection is secure" : "Your connection is not secure"}
      </react_native_1.Text>
    </react_native_1.View>);
};
exports.ConnectionButton = ConnectionButton;
const styles = react_native_1.StyleSheet.create({
    container: {
        alignItems: 'center',
        marginVertical: 30,
    },
    button: {
        width: 200,
        height: 200,
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    buttonSubtext: {
        color: '#ffffff',
        fontSize: 14,
        opacity: 0.8,
    },
    status: {
        marginTop: 16,
        fontSize: 16,
        textAlign: 'center',
    },
});
