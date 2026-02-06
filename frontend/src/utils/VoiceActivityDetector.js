// 🎤 DETECTOR DE ACTIVIDAD DE VOZ
export class VoiceActivityDetector {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.isInitialized = false;
    }
    
    async initialize() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const source = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            
            source.connect(this.analyser);
            
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.isInitialized = true;
            
            return true;
        } catch (error) {
            console.error('Error inicializando VAD:', error);
            return false;
        }
    }
    
    // 🎯 DETECTAR SI HAY ACTIVIDAD DE VOZ REAL
    isVoiceDetected(threshold = 40) {
        if (!this.isInitialized) return false;
        
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Analizar frecuencias típicas de voz humana (300Hz - 3400Hz)
        const voiceRange = this.dataArray.slice(8, 85); // Aproximadamente estas frecuencias
        const average = voiceRange.reduce((a, b) => a + b, 0) / voiceRange.length;
        
        return average > threshold;
    }
    
    // 🎵 NIVEL DE RUIDO AMBIENTE
    getNoiseLevel() {
        if (!this.isInitialized) return 0;
        
        this.analyser.getByteFrequencyData(this.dataArray);
        return this.dataArray.reduce((a, b) => a + b, 0) / this.dataArray.length;
    }
}