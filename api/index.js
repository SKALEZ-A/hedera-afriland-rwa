"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
function handler(_req, res) {
    res.status(200).json({
        message: 'GlobalLand RWA Platform API',
        status: 'online',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: '/api/health',
            docs: '/api/docs'
        }
    });
}
//# sourceMappingURL=index.js.map