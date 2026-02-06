import React, { createContext, useContext, useState, useEffect } from 'react';
import { TokenValidator } from '../utils/tokenValidator';

// Crear el contexto
const AuthContext = createContext();

// Hook personalizado para acceder al contexto
export const useAuth = () => useContext(AuthContext);

// Proveedor del contexto de autenticación
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // 🆕 Al montar el componente, verificar si hay un usuario Y validar el token
    useEffect(() => {
        const initializeAuth = () => {
            const storedUser = localStorage.getItem('user');
            const token = localStorage.getItem('token');
            
            if (storedUser && token) {
                // Verificar si el token aún es válido
                if (TokenValidator.isStoredTokenValid()) {
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);
                    
                    const tokenInfo = TokenValidator.getTokenInfo(token);
                    console.log('✅ Sesión restaurada:', {
                        usuario: parsedUser.nombre,
                        expira: tokenInfo.remainingFormatted
                    });
                } else {
                    // Token expirado, limpiar todo
                    console.log('❌ Token expirado al iniciar, limpiando sesión');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setUser(null);
                }
            }
            setLoading(false);
        };

        initializeAuth();
    }, []);

    // 🆕 Función para verificar si la sesión sigue siendo válida
    const isSessionValid = () => {
        const token = localStorage.getItem('token');
        if (!token) return false;
        return !TokenValidator.isTokenExpired(token);
    };

    // 🆕 Función para obtener información de la sesión
    const getSessionInfo = () => {
        const token = localStorage.getItem('token');
        if (!token) return null;
        return TokenValidator.getTokenInfo(token);
    };

    // Función para iniciar sesión
    const login = ({ user, token }) => {
        console.log('Login recibió usuario:', user);
        
        // Validar y corregir el usuario si es necesario
        let validUser = { ...user };
        
        // Verificar si el ID es nulo o indefinido
        if (!validUser || !validUser.id || validUser.id === null) {
            console.error('Error: información de usuario incompleta en login', validUser);
            
            // Intentar recuperar el ID de diferentes fuentes
            try {
                // Verificar si hay un usuario temporal con ID en localStorage
                const tempUser = JSON.parse(localStorage.getItem('tempUserWithId'));
                if (tempUser && tempUser.id && tempUser.email === validUser.email) {
                    validUser.id = tempUser.id;
                    console.log('Recuperado ID desde usuario temporal:', validUser.id);
                } else {
                    // Crear un ID temporal basado en el correo electrónico si está disponible
                    if (validUser && validUser.email) {
                        const tempId = validUser.email.split('@')[0].length * 123456;
                        validUser.id = tempId;
                        console.log('Generado ID temporal basado en email:', validUser.id);
                    } else {
                        // Último recurso: generar un ID aleatorio
                        validUser.id = Math.floor(Math.random() * 1000000) + 1;
                        console.log('Generado ID aleatorio como último recurso:', validUser.id);
                    }
                }
            } catch (e) {
                console.error('Error al intentar recuperar/generar ID:', e);
                // Último recurso: generar un ID aleatorio
                validUser.id = Math.floor(Math.random() * 1000000) + 1;
                console.log('Generado ID aleatorio como último recurso después de error:', validUser.id);
            }
        }
        
        // Convertir ID a número si es string
        if (typeof validUser.id === 'string') {
            validUser.id = parseInt(validUser.id, 10);
        }
        
        console.log("Guardando información de usuario en contexto:", validUser);
        
        // Establecer el usuario en el contexto
        setUser(validUser);
        
        // Guardar en localStorage
        localStorage.setItem('user', JSON.stringify(validUser));
        localStorage.setItem('token', token);
        
        // 🆕 Mostrar información del token
        const tokenInfo = TokenValidator.getTokenInfo(token);
        console.log('🎟️ Información del token:', tokenInfo);
    }; 

    // Función para cerrar sesión
    const logout = () => {
        console.log('🚪 Cerrando sesión...');
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    };

    // Proporcionar el contexto con las nuevas funciones
    return (
        <AuthContext.Provider value={{ 
            user, 
            login, 
            logout, 
            loading,
            isSessionValid,
            getSessionInfo
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
