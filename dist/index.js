"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultTheme = exports.Auth = exports.StatusCard = exports.ConnectionButton = exports.ClientCreator = exports.useVPN = exports.VPNProvider = void 0;
var VPNProvider_1 = require("./components/VPNProvider");
Object.defineProperty(exports, "VPNProvider", { enumerable: true, get: function () { return VPNProvider_1.VPNProvider; } });
Object.defineProperty(exports, "useVPN", { enumerable: true, get: function () { return VPNProvider_1.useVPN; } });
var ClientCreator_1 = require("./components/ClientCreator");
Object.defineProperty(exports, "ClientCreator", { enumerable: true, get: function () { return ClientCreator_1.ClientCreator; } });
var ConnectionButton_1 = require("./components/ConnectionButton");
Object.defineProperty(exports, "ConnectionButton", { enumerable: true, get: function () { return ConnectionButton_1.ConnectionButton; } });
var StatusCard_1 = require("./components/StatusCard");
Object.defineProperty(exports, "StatusCard", { enumerable: true, get: function () { return StatusCard_1.StatusCard; } });
var Auth_1 = require("./components/Auth");
Object.defineProperty(exports, "Auth", { enumerable: true, get: function () { return Auth_1.Auth; } });
exports.defaultTheme = {
    background: '#f5f5f5',
    surface: '#ffffff',
    primary: '#6366f1',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    text: '#000000',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
};
