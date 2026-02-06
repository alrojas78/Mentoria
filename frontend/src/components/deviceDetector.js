// src/utils/DeviceDetector.js

class DeviceDetector {
    constructor() {
        this.userAgent = navigator.userAgent || '';
        this.platform = navigator.platform || '';
        this.maxTouchPoints = navigator.maxTouchPoints || 0;
    }

    // ✅ DETECCIÓN ROBUSTA PARA iOS (iPhone, iPad, iPod)
    // Incluye detección de iPadOS 13+ que se reporta como Mac
    // NO incluye Macs de escritorio (solo dispositivos táctiles)
    isIOS() {
        // 1. Detección directa: iPhone, iPad antiguo, iPod
        const isDirectIOS = /iPad|iPhone|iPod/.test(this.userAgent) && !window.MSStream;

        // 2. Detección de iPad con iPadOS 13+ (se reporta como Mac)
        // Los iPads tienen touch screen (maxTouchPoints > 0), las Macs de escritorio no
        const isIPadOS13Plus = (
            /Macintosh/.test(this.userAgent) &&
            this.maxTouchPoints > 0
        );

        return isDirectIOS || isIPadOS13Plus;
    }
    
    // Helper para detectar Chrome en iOS específicamente (Opcional, informativo)
    isChromeIOS() {
        return /CriOS/.test(this.userAgent);
    }
    
    // Detectar Android
    isAndroid() {
        return /Android/.test(this.userAgent);
    }
    
    // Configuración para el Router
    // Detecta dispositivos móviles: iOS (iPhone, iPad) y Android
    isMobile() {
        return this.isIOS() || this.isAndroid();
    }

    getDeviceInfo() {
        return {
            isIOS: this.isIOS(),
            isAndroid: this.isAndroid(),
            isChromeIOS: this.isChromeIOS(),
            isMobile: this.isMobile(),
            maxTouchPoints: this.maxTouchPoints,
            platform: this.platform,
            userAgent: this.userAgent
        };
    }
}

const deviceDetector = new DeviceDetector();
export default deviceDetector;