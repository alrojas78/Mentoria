// 🔐 UTILIDAD PARA VALIDAR TOKENS JWT
export class TokenValidator {
    
    /**
     * Decodifica un JWT sin validar la firma (solo lectura del payload)
     * @param {string} token - Token JWT
     * @returns {object|null} - Payload decodificado o null si es inválido
     */
    static decodeToken(token) {
        if (!token || typeof token !== 'string') return null;
        
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            
            // Decodificar el payload (segunda parte del JWT)
            const payload = JSON.parse(atob(parts[1]));
            return payload;
        } catch (error) {
            console.error('❌ Error decodificando token:', error);
            return null;
        }
    }
    
    /**
     * Verifica si un token ha expirado
     * @param {string} token - Token JWT
     * @returns {boolean} - true si expiró, false si aún es válido
     */
    static isTokenExpired(token) {
        const decoded = this.decodeToken(token);
        if (!decoded || !decoded.exp) {
            console.warn('⚠️ Token sin fecha de expiración');
            return true;
        }
        
        const now = Math.floor(Date.now() / 1000); // Tiempo actual en segundos
        const isExpired = decoded.exp < now;
        
        if (isExpired) {
            console.log('⏰ Token expirado:', {
                expiracion: new Date(decoded.exp * 1000).toLocaleString(),
                ahora: new Date(now * 1000).toLocaleString(),
                diferencia: `${Math.floor((now - decoded.exp) / 60)} minutos`
            });
        }
        
        return isExpired;
    }
    
    /**
     * Obtiene el tiempo restante antes de que expire el token (en segundos)
     * @param {string} token - Token JWT
     * @returns {number} - Segundos restantes o 0 si ya expiró
     */
    static getTimeUntilExpiration(token) {
        const decoded = this.decodeToken(token);
        if (!decoded || !decoded.exp) return 0;
        
        const now = Math.floor(Date.now() / 1000);
        const remaining = decoded.exp - now;
        
        return Math.max(0, remaining);
    }
    
    /**
     * Verifica si el token está próximo a expirar
     * @param {string} token - Token JWT
     * @param {number} thresholdMinutes - Minutos antes de expiración para considerar "próximo" (default: 5)
     * @returns {boolean}
     */
    static isTokenExpiringSoon(token, thresholdMinutes = 5) {
        const remaining = this.getTimeUntilExpiration(token);
        const thresholdSeconds = thresholdMinutes * 60;
        
        return remaining > 0 && remaining < thresholdSeconds;
    }
    
    /**
     * Obtiene información completa del token
     * @param {string} token - Token JWT
     * @returns {object} - Información del token
     */
    static getTokenInfo(token) {
        const decoded = this.decodeToken(token);
        if (!decoded) {
            return {
                valid: false,
                expired: true,
                remaining: 0,
                message: 'Token inválido'
            };
        }
        
        const now = Math.floor(Date.now() / 1000);
        const isExpired = decoded.exp < now;
        const remaining = Math.max(0, decoded.exp - now);
        
        return {
            valid: !isExpired,
            expired: isExpired,
            remaining: remaining,
            remainingFormatted: this.formatTime(remaining),
            issuedAt: decoded.iat ? new Date(decoded.iat * 1000) : null,
            expiresAt: decoded.exp ? new Date(decoded.exp * 1000) : null,
            userData: decoded.data || null,
            message: isExpired ? 'Token expirado' : 'Token válido'
        };
    }
    
    /**
     * Formatea segundos a formato legible (HH:MM:SS)
     * @param {number} seconds - Segundos
     * @returns {string} - Tiempo formateado
     */
    static formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
    
    /**
     * Verifica si existe un token almacenado
     * @returns {boolean}
     */
    static hasToken() {
        const token = localStorage.getItem('token');
        return !!token;
    }
    
    /**
     * Obtiene el token almacenado
     * @returns {string|null}
     */
    static getStoredToken() {
        return localStorage.getItem('token');
    }
    
    /**
     * Verifica si el token almacenado es válido
     * @returns {boolean}
     */
    static isStoredTokenValid() {
        const token = this.getStoredToken();
        if (!token) return false;
        return !this.isTokenExpired(token);
    }
}
