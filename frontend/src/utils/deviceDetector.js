// src/utils/DeviceDetector.js

class DeviceDetector {
    constructor() {
        this.userAgent = navigator.userAgent || '';
        this.platform = navigator.platform || '';
        this.maxTouchPoints = navigator.maxTouchPoints || 0;
    }

    // ✅ DETECCIÓN ROBUSTA PARA iOS (iPhone, iPad, iPod)
    // Incluye detección de iPadOS 13+ que se reporta como Mac
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
    
    // Detecta si es Safari PURO (No Chrome)
    isSafari() {
        return /Safari/.test(this.userAgent) && !/Chrome|CriOS/.test(this.userAgent);
    }
    
    isIOSSafari() {
        return this.isIOS() && this.isSafari();
    }
    
    isAndroid() {
        return /Android/.test(this.userAgent);
    }
    
    // ✅ MAESTRO: ¿Es dispositivo móvil o Apple?
    // Usa ESTO en tu Router: deviceDetector.isMobile()
    isMobile() {
        return this.isIOS() || this.isAndroid();
    }
    
    getDeviceInfo() {
        return {
            isIOS: this.isIOS(),
            isMobile: this.isMobile(),
            isAndroid: this.isAndroid(),
            isSafari: this.isSafari(),
            maxTouchPoints: this.maxTouchPoints,
            platform: this.platform,
            userAgent: this.userAgent
        };
    }
}

const deviceDetector = new DeviceDetector();
export default deviceDetector;