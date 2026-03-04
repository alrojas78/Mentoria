// AdminLandingEditor.js — Editor de secciones de landing por proyecto
import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import { proyectoService } from '../../services/api';
import HeroForm from './landing-forms/HeroForm';
import StatsForm from './landing-forms/StatsForm';
import GenericSectionForm from './landing-forms/GenericSectionForm';

const SECTION_TYPES = [
  { value: 'header', label: 'Header personalizado' },
  { value: 'hero', label: 'Hero (Banner principal)' },
  { value: 'stats', label: 'Estadísticas' },
  { value: 'feature_cards', label: 'Tarjetas de características' },
  { value: 'contenidos_carousel', label: 'Contenidos (Netflix)' },
  { value: 'icon_text_grid', label: 'Grilla icono + texto' },
  { value: 'text_block', label: 'Bloque de texto' },
  { value: 'image_gallery', label: 'Galería de imágenes' },
  { value: 'cta_button', label: 'Botón Call to Action' },
  { value: 'testimonials', label: 'Testimonios' },
  { value: 'custom_html', label: 'HTML personalizado' },
  { value: 'footer', label: 'Footer personalizado' },
];

const FONT_OPTIONS = [
  { value: "'Myriad Pro', sans-serif", label: 'Myriad Pro (default)' },
  { value: "'Roboto', sans-serif", label: 'Roboto' },
  { value: "'Open Sans', sans-serif", label: 'Open Sans' },
  { value: "'Montserrat', sans-serif", label: 'Montserrat' },
  { value: "'Poppins', sans-serif", label: 'Poppins' },
  { value: "'Lato', sans-serif", label: 'Lato' },
  { value: "'Inter', sans-serif", label: 'Inter' },
  { value: "'Playfair Display', serif", label: 'Playfair Display' },
  { value: "Georgia, serif", label: 'Georgia' },
];

const Overlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
`;

const Panel = styled.div`
  background: #fff;
  border-radius: 16px;
  width: 95%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
`;

const HeaderTitle = styled.h3`
  margin: 0;
  color: #0f355b;
  font-size: 1.15rem;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #64748b;
  &:hover { color: #0f355b; }
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  gap: 0.75rem;
`;

const Btn = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
`;

const PrimaryBtn = styled(Btn)`
  background: linear-gradient(135deg, #0f355b, #14b6cb);
  color: #fff;
  &:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(20,182,203,0.3); }
  &:disabled { opacity: 0.5; cursor: default; transform: none; }
`;

const SecondaryBtn = styled(Btn)`
  background: #f1f5f9;
  color: #475569;
  &:hover { background: #e2e8f0; }
`;

const AddBar = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const Select = styled.select`
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  flex: 1;
  min-width: 200px;
  &:focus { outline: none; border-color: #14b6cb; }
`;

const SectionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const SectionItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: ${p => p.$editing ? '#eef7ff' : (p.$hidden ? '#fef2f2' : '#f8fafc')};
  border: 1px solid ${p => p.$editing ? '#14b6cb' : '#e2e8f0'};
  border-radius: 10px;
  transition: all 0.15s;
`;

const SectionOrder = styled.span`
  background: #0f355b;
  color: #fff;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: bold;
  flex-shrink: 0;
`;

const SectionLabel = styled.div`
  flex: 1;
  font-weight: 600;
  font-size: 0.9rem;
  color: ${p => p.$hidden ? '#94a3b8' : '#0f355b'};
  span { font-weight: 400; color: #94a3b8; font-size: 0.82rem; margin-left: 0.5rem; }
`;

const SmallBtn = styled.button`
  background: none;
  border: 1px solid #e2e8f0;
  color: #475569;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  transition: all 0.15s;
  flex-shrink: 0;
  &:hover { border-color: #14b6cb; color: #14b6cb; }
  &:disabled { opacity: 0.3; cursor: default; }
`;

const DeleteSmallBtn = styled(SmallBtn)`
  &:hover { border-color: #ef4444; color: #ef4444; }
`;

const EditPanel = styled.div`
  margin-top: 1rem;
  padding: 1.25rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
`;

const EditTitle = styled.div`
  font-weight: 600;
  color: #0f355b;
  margin-bottom: 1rem;
  font-size: 0.95rem;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  color: #94a3b8;
  font-size: 0.95rem;
`;

const GlobalConfigPanel = styled.div`
  background: #f0f4ff;
  border: 1px solid #c7d2fe;
  border-radius: 10px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
`;

const GlobalConfigTitle = styled.div`
  font-weight: 700;
  font-size: 0.88rem;
  color: #0f355b;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
`;

const GlobalConfigGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  @media (max-width: 600px) { grid-template-columns: 1fr; }
`;

const GCLabel = styled.label`
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
`;

const GCSelect = styled.select`
  padding: 0.45rem 0.7rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.85rem;
  &:focus { outline: none; border-color: #14b6cb; }
`;

const GCGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const AdminLandingEditor = ({ proyecto, onClose, onSaved }) => {
  const [secciones, setSecciones] = useState([]);
  const [landingConfig, setLandingConfig] = useState({});
  const [showGlobalConfig, setShowGlobalConfig] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newType, setNewType] = useState('hero');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const existing = proyecto?.config_json?.landing_secciones;
    setSecciones(Array.isArray(existing) ? JSON.parse(JSON.stringify(existing)) : []);
    const existingConfig = proyecto?.config_json?.landing_config;
    setLandingConfig(existingConfig ? JSON.parse(JSON.stringify(existingConfig)) : {});
  }, [proyecto]);

  const setGC = (key, val) => { setLandingConfig(prev => ({ ...prev, [key]: val })); setDirty(true); };

  const genId = () => 'sec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

  const addSection = () => {
    const nueva = {
      id: genId(),
      tipo: newType,
      visible: true,
      orden: secciones.length,
      config: {}
    };
    setSecciones(prev => [...prev, nueva]);
    setEditingId(nueva.id);
    setDirty(true);
  };

  const moveSection = (idx, dir) => {
    const newArr = [...secciones];
    const target = idx + dir;
    if (target < 0 || target >= newArr.length) return;
    [newArr[idx], newArr[target]] = [newArr[target], newArr[idx]];
    newArr.forEach((s, i) => { s.orden = i; });
    setSecciones(newArr);
    setDirty(true);
  };

  const toggleVisible = (idx) => {
    const newArr = [...secciones];
    newArr[idx] = { ...newArr[idx], visible: !newArr[idx].visible };
    setSecciones(newArr);
    setDirty(true);
  };

  const deleteSection = (idx) => {
    if (!window.confirm('¿Eliminar esta sección?')) return;
    const newArr = secciones.filter((_, i) => i !== idx);
    newArr.forEach((s, i) => { s.orden = i; });
    setSecciones(newArr);
    if (secciones[idx]?.id === editingId) setEditingId(null);
    setDirty(true);
  };

  const updateConfig = useCallback((seccionId, newConfig) => {
    setSecciones(prev =>
      prev.map(s => s.id === seccionId ? { ...s, config: newConfig } : s)
    );
    setDirty(true);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Guardar secciones y config global juntos
      await proyectoService.updateJSON({
        id: proyecto.id,
        config_json: {
          landing_secciones: secciones,
          landing_config: landingConfig,
        }
      });
      toast.success('Landing guardada exitosamente');
      setDirty(false);
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando landing');
    } finally {
      setSaving(false);
    }
  };

  const getLabelForType = (tipo) => SECTION_TYPES.find(t => t.value === tipo)?.label || tipo;

  const renderEditForm = (seccion) => {
    const props = {
      config: seccion.config,
      onChange: (newConfig) => updateConfig(seccion.id, newConfig),
      proyectoId: proyecto.id,
      seccionId: seccion.id,
    };

    switch (seccion.tipo) {
      case 'hero': return <HeroForm {...props} />;
      case 'stats': return <StatsForm {...props} />;
      default: return <GenericSectionForm {...props} tipo={seccion.tipo} />;
    }
  };

  return (
    <Overlay onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Panel>
        <Header>
          <HeaderTitle>Landing Editor — {proyecto?.nombre}</HeaderTitle>
          <CloseBtn onClick={onClose}>&times;</CloseBtn>
        </Header>

        <Body>
          {/* Panel de configuración global */}
          <GlobalConfigPanel>
            <GlobalConfigTitle onClick={() => setShowGlobalConfig(!showGlobalConfig)}>
              {showGlobalConfig ? '▼' : '▶'} Configuración Global (Fuentes)
            </GlobalConfigTitle>
            {showGlobalConfig && (
              <GlobalConfigGrid>
                <GCGroup>
                  <GCLabel>Fuente principal (todo el landing)</GCLabel>
                  <GCSelect value={landingConfig.fuente_principal || "'Myriad Pro', sans-serif"} onChange={e => setGC('fuente_principal', e.target.value)}>
                    {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </GCSelect>
                </GCGroup>
                <GCGroup>
                  <GCLabel>Fuente títulos (opcional, si diferente)</GCLabel>
                  <GCSelect value={landingConfig.fuente_titulos || ''} onChange={e => setGC('fuente_titulos', e.target.value)}>
                    <option value="">Misma que principal</option>
                    {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </GCSelect>
                </GCGroup>
              </GlobalConfigGrid>
            )}
          </GlobalConfigPanel>

          <AddBar>
            <Select value={newType} onChange={e => setNewType(e.target.value)}>
              {SECTION_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
            <PrimaryBtn onClick={addSection}>+ Agregar sección</PrimaryBtn>
          </AddBar>

          {secciones.length === 0 ? (
            <EmptyState>
              No hay secciones configuradas.<br/>
              Agrega secciones para personalizar la landing de este proyecto.
            </EmptyState>
          ) : (
            <SectionList>
              {secciones.map((sec, idx) => (
                <React.Fragment key={sec.id}>
                  <SectionItem $editing={editingId === sec.id} $hidden={!sec.visible}>
                    <SectionOrder>{idx + 1}</SectionOrder>
                    <SectionLabel $hidden={!sec.visible}>
                      {getLabelForType(sec.tipo)}
                      {sec.config?.titulo && <span>— {sec.config.titulo}</span>}
                      {!sec.visible && <span>(oculta)</span>}
                    </SectionLabel>
                    <SmallBtn onClick={() => moveSection(idx, -1)} disabled={idx === 0} title="Subir">↑</SmallBtn>
                    <SmallBtn onClick={() => moveSection(idx, 1)} disabled={idx === secciones.length - 1} title="Bajar">↓</SmallBtn>
                    <SmallBtn onClick={() => toggleVisible(idx)} title={sec.visible ? 'Ocultar' : 'Mostrar'}>
                      {sec.visible ? '👁' : '👁‍🗨'}
                    </SmallBtn>
                    <SmallBtn onClick={() => setEditingId(editingId === sec.id ? null : sec.id)} title="Editar">
                      ✏️
                    </SmallBtn>
                    <DeleteSmallBtn onClick={() => deleteSection(idx)} title="Eliminar">🗑</DeleteSmallBtn>
                  </SectionItem>

                  {editingId === sec.id && (
                    <EditPanel>
                      <EditTitle>Configurar: {getLabelForType(sec.tipo)}</EditTitle>
                      {renderEditForm(sec)}
                    </EditPanel>
                  )}
                </React.Fragment>
              ))}
            </SectionList>
          )}
        </Body>

        <Footer>
          <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            {secciones.length} sección{secciones.length !== 1 ? 'es' : ''} • {secciones.filter(s => s.visible).length} visible{secciones.filter(s => s.visible).length !== 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <SecondaryBtn onClick={onClose}>Cerrar</SecondaryBtn>
            <PrimaryBtn onClick={handleSave} disabled={saving || !dirty}>
              {saving ? 'Guardando...' : 'Guardar Landing'}
            </PrimaryBtn>
          </div>
        </Footer>
      </Panel>
    </Overlay>
  );
};

export default AdminLandingEditor;
