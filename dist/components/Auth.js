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
    const [apiKey, setApiKey] = (0, react_1.useState)('');
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const createOrganization = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('https://gateway.dev.netsepio.com/api/v1.1/organisation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const data = await response.json();
            setApiKey(data.api_key);
            react_native_1.Alert.alert('Success', 'Organization created successfully! API Key: ' + data.api_key);
        }
        catch (error) {
            react_native_1.Alert.alert('Error', 'Failed to create organization');
            console.error('Error creating organization:', error);
        }
        finally {
            setIsLoading(false);
        }
    };
    const getToken = async () => {
        if (!apiKey) {
            react_native_1.Alert.alert('Error', 'Please create an organization first or enter an API key');
            return;
        }
        try {
            setIsLoading(true);
            const response = await fetch('https://gateway.dev.netsepio.com/api/v1.1/organisation/token', {
                method: 'GET',
                headers: {
                    'X-API-Key': apiKey,
                },
            });
            const data = await response.json();
            if (data.status === 200) {
                onTokenReceived(data.payload.Token);
                react_native_1.Alert.alert('Success', 'Token generated successfully!');
            }
            else {
                throw new Error(data.message);
            }
        }
        catch (error) {
            react_native_1.Alert.alert('Error', 'Failed to generate token');
            console.error('Error generating token:', error);
        }
        finally {
            setIsLoading(false);
        }
    };
    return (<react_native_1.View style={styles.container}>
      <react_native_1.Text style={styles.title}>Authentication</react_native_1.Text>
      
      <react_native_1.TouchableOpacity style={styles.button} onPress={createOrganization} disabled={isLoading}>
        <react_native_1.Text style={styles.buttonText}>
          {isLoading ? 'Creating...' : 'Create New Organization'}
        </react_native_1.Text>
      </react_native_1.TouchableOpacity>

      <react_native_1.TextInput style={styles.input} placeholder="Enter API Key" value={apiKey} onChangeText={setApiKey} autoCapitalize="none" autoCorrect={false}/>

      <react_native_1.TouchableOpacity style={styles.button} onPress={getToken} disabled={isLoading}>
        <react_native_1.Text style={styles.buttonText}>
          {isLoading ? 'Generating...' : 'Generate Token'}
        </react_native_1.Text>
      </react_native_1.TouchableOpacity>
    </react_native_1.View>);
};
exports.Auth = Auth;
const styles = react_native_1.StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 10,
        borderRadius: 5,
        marginBottom: 15,
        fontSize: 16,
    },
    button: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 5,
        marginBottom: 15,
    },
    buttonText: {
        color: '#fff',
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
    },
});
