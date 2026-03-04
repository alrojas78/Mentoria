// contexts/ProjectContext.js — Fase 9: Multi-Proyecto
// Detecta el proyecto actual por dominio/subdominio y expone su info al frontend
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';

const ProjectContext = createContext(null);

export const ProjectProvider = ({ children }) => {
  const [proyecto, setProyecto] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProyecto = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/proyecto-info.php`);
        if (res.data?.success && res.data.proyecto) {
          setProyecto(res.data.proyecto);

          // Aplicar colores como CSS custom properties
          const p = res.data.proyecto;
          if (p.color_primario) {
            document.documentElement.style.setProperty('--project-primary', p.color_primario);
          }
          if (p.color_secundario) {
            document.documentElement.style.setProperty('--project-secondary', p.color_secundario);
          }
        }
      } catch (err) {
        // Sin proyecto = landing default MentorIA (no es error)
        console.log('ProjectContext: sin proyecto detectado para este dominio');
      } finally {
        setLoading(false);
      }
    };

    fetchProyecto();
  }, []);

  return (
    <ProjectContext.Provider value={{ proyecto, loading }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const ctx = useContext(ProjectContext);
  if (ctx === null) {
    return { proyecto: null, loading: false };
  }
  return ctx;
};

export default ProjectContext;
