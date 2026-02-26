import React, { useState, useEffect, useCallback } from 'react';
import { consultaService } from '../../services/api';
import AttachmentManager from '../../components/AttachmentManager';
import axios from 'axios';

const SYSTEM_ROLES = ['admin', 'mentor', 'coordinador'];
const BACKEND_BASE = 'https://mentoria.ateneo.co/backend';

// Estilos reutilizables
const styles = {
  container: { padding: '2rem', maxWidth: '1400px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  tab: (active) => ({
    padding: '0.75rem 1.5rem',
    border: 'none',
    borderBottom: active ? '3px solid #0891B2' : '3px solid transparent',
    backgroundColor: 'transparent',
    color: active ? '#0891B2' : '#6b7280',
    fontWeight: active ? '600' : '400',
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  }),
  input: { width: '100%', padding: '0.6rem', marginBottom: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.95rem' },
  textarea: { width: '100%', padding: '0.6rem', marginBottom: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.95rem', fontFamily: 'inherit' },
  section: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem', backgroundColor: '#f8f9fa' },
  btnPrimary: { backgroundColor: '#0891B2', color: '#fff', border: 'none', padding: '0.7rem 1.5rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem' },
  btnSecondary: { backgroundColor: '#2b4361', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' },
  btnDanger: { backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500' },
  btnWarning: { backgroundColor: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500' },
  badge: (color = '#0891B2') => ({ backgroundColor: color, color: '#fff', padding: '0.1rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', textTransform: 'capitalize' }),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' },
  alert: (type) => ({ padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', backgroundColor: type === 'success' ? '#d1fae5' : '#fee2e2', color: type === 'success' ? '#065f46' : '#991b1b', fontSize: '0.9rem' })
};

const AdminDocumentosPage = ({ embedded = false }) => {
  // Vista: 'list' o 'form'
  const [vista, setVista] = useState('list');
  const [activeTab, setActiveTab] = useState('general');

  const [documentos, setDocumentos] = useState([]);
  const [editingDoc, setEditingDoc] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [contenido, setContenido] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Evaluación
  const [preguntasEvaluacion, setPreguntasEvaluacion] = useState(10);
  const [porcentajeAprobacion, setPorcentajeAprobacion] = useState(60);
  const [tieneCertificado, setTieneCertificado] = useState(false);
  const [maxIntentos, setMaxIntentos] = useState(3);
  const [puntuacionCompleta, setPuntuacionCompleta] = useState(1.00);
  const [puntuacionParcial, setPuntuacionParcial] = useState(0.80);
  const [puntuacionMinima, setPuntuacionMinima] = useState(0.40);
  const [umbralParcial, setUmbralParcial] = useState(0.30);
  const [tiempoRespuesta, setTiempoRespuesta] = useState(60);

  // Modos de aprendizaje
  const [modoConsulta, setModoConsulta] = useState(true);
  const [modoMentor, setModoMentor] = useState(true);
  const [modoEvaluacion, setModoEvaluacion] = useState(true);
  const [modoReto, setModoReto] = useState(true);

  // Roles e imagen
  const [rolesDisponibles, setRolesDisponibles] = useState([...SYSTEM_ROLES]);
  const [rolesAsignados, setRolesAsignados] = useState([...SYSTEM_ROLES]);
  const [imagenFile, setImagenFile] = useState(null);
  const [imagenPreview, setImagenPreview] = useState(null);

  // ID temporal para AttachmentManager en documentos recién creados
  const [savedDocId, setSavedDocId] = useState(null);

  // Bloques temáticos
  const [bloques, setBloques] = useState([]);
  const [resumenDoc, setResumenDoc] = useState('');
  const [generandoBloques, setGenerandoBloques] = useState(false);
  const [bloquesExpandidos, setBloquesExpandidos] = useState({});

  const cargarBloques = useCallback(async (docId) => {
    if (!docId) return;
    try {
      const res = await axios.get(`${BACKEND_BASE}/api/admin/generar-bloques.php`, {
        params: { documento_id: docId },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.data?.success) {
        setBloques(res.data.bloques || []);
        setResumenDoc(res.data.resumen || '');
      }
    } catch (err) {
      console.error('Error cargando bloques:', err);
    }
  }, []);

  const generarBloques = async (docId) => {
    if (!docId) return;
    if (!window.confirm('Esto analizara el contenido con IA y creara bloques tematicos automaticamente. Los bloques anteriores se eliminaran. ¿Continuar?')) return;

    setGenerandoBloques(true);
    setError('');
    setMensaje('');
    try {
      const res = await axios.post(`${BACKEND_BASE}/api/admin/generar-bloques.php`, {
        documento_id: docId
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      });
      if (res.data?.success) {
        setBloques(res.data.bloques?.map((b, i) => ({
          id: i + 1,
          orden: b.orden,
          titulo: b.titulo,
          resumen_bloque: b.resumen,
          tokens_estimados: b.tokens_estimados
        })) || []);
        setResumenDoc(res.data.resumen || '');
        setMensaje(`${res.data.bloques_creados} bloques creados exitosamente (~${res.data.total_tokens} tokens total)`);
      }
    } catch (err) {
      setError('Error al generar bloques: ' + (err.response?.data?.error || err.message));
    } finally {
      setGenerandoBloques(false);
      // Recargar bloques reales desde DB
      await cargarBloques(docId);
    }
  };

  const eliminarBloques = async (docId) => {
    if (!docId) return;
    if (!window.confirm('¿Eliminar todos los bloques y el resumen de este documento?')) return;

    try {
      await axios.delete(`${BACKEND_BASE}/api/admin/generar-bloques.php`, {
        data: { documento_id: docId },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      setBloques([]);
      setResumenDoc('');
      setMensaje('Bloques y resumen eliminados.');
    } catch (err) {
      setError('Error al eliminar bloques.');
    }
  };

  useEffect(() => {
    cargarDocumentos();
    // Cargar grupos de contenido para roles dinámicos
    axios.get(`${BACKEND_BASE}/api/admin/content-groups.php`)
      .then(res => {
        if (res.data?.success) {
          const groupNames = res.data.groups.map(g => g.name);
          const allRoles = [...SYSTEM_ROLES, ...groupNames];
          setRolesDisponibles(allRoles);
        }
      })
      .catch(() => {}); // Silenciar error, usa default
  }, []);

  const cargarDocumentos = async () => {
    try {
      const res = await consultaService.getDocumentos();
      setDocumentos(res.data || []);
    } catch (err) {
      setError('Error al cargar documentos.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');
    setError('');

    if (!titulo || !contenido) {
      setError('El titulo y el contenido son obligatorios');
      return;
    }

    try {
      if (editingDoc) {
        const updateData = {
          id: editingDoc.id,
          titulo, descripcion, contenido,
          preguntas_por_evaluacion: preguntasEvaluacion,
          porcentaje_aprobacion: porcentajeAprobacion,
          tiene_certificado: tieneCertificado ? 1 : 0,
          max_intentos: maxIntentos,
          puntuacion_respuesta_completa: puntuacionCompleta,
          puntuacion_respuesta_parcial: puntuacionParcial,
          puntuacion_respuesta_minima: puntuacionMinima,
          umbral_respuesta_parcial: umbralParcial,
          tiempo_respuesta_segundos: tiempoRespuesta,
          roles: rolesAsignados,
          modo_consulta: modoConsulta ? 1 : 0,
          modo_mentor: modoMentor ? 1 : 0,
          modo_evaluacion: modoEvaluacion ? 1 : 0,
          modo_reto: modoReto ? 1 : 0
        };
        await consultaService.updateDocumento(updateData);
        if (imagenFile) {
          await consultaService.uploadDocumentoImagen(editingDoc.id, imagenFile);
        }
        setMensaje('Documento actualizado correctamente.');
      } else {
        const formData = new FormData();
        formData.append('titulo', titulo);
        formData.append('descripcion', descripcion);
        formData.append('contenido', contenido);
        formData.append('preguntas_por_evaluacion', preguntasEvaluacion.toString());
        formData.append('porcentaje_aprobacion', porcentajeAprobacion.toString());
        formData.append('tiene_certificado', tieneCertificado ? '1' : '0');
        formData.append('max_intentos', maxIntentos.toString());
        formData.append('puntuacion_respuesta_completa', puntuacionCompleta.toString());
        formData.append('puntuacion_respuesta_parcial', puntuacionParcial.toString());
        formData.append('puntuacion_respuesta_minima', puntuacionMinima.toString());
        formData.append('umbral_respuesta_parcial', umbralParcial.toString());
        formData.append('tiempo_respuesta_segundos', tiempoRespuesta.toString());
        formData.append('roles', rolesAsignados.join(','));
        formData.append('modo_consulta', modoConsulta ? '1' : '0');
        formData.append('modo_mentor', modoMentor ? '1' : '0');
        formData.append('modo_evaluacion', modoEvaluacion ? '1' : '0');
        formData.append('modo_reto', modoReto ? '1' : '0');
        if (imagenFile) {
          formData.append('imagen', imagenFile);
        }

        const res = await consultaService.createDocumento(formData);
        const newId = res.data?.id;
        if (newId) setSavedDocId(newId);
        setMensaje('Documento creado correctamente.' + (newId ? ' Ahora puede agregar anexos en la pestaña "Anexos y Media".' : ''));
      }

      cargarDocumentos();
    } catch (err) {
      setError('Error al guardar el documento.');
    }
  };

  const handleEdit = (doc) => {
    setEditingDoc(doc);
    setTitulo(doc.titulo);
    setDescripcion(doc.descripcion || '');
    setContenido(doc.contenido || '');
    setPreguntasEvaluacion(doc.preguntas_por_evaluacion || 10);
    setPorcentajeAprobacion(doc.porcentaje_aprobacion || 60);
    setTieneCertificado(doc.tiene_certificado || false);
    setMaxIntentos(doc.max_intentos || 3);
    setPuntuacionCompleta(doc.puntuacion_respuesta_completa || 1.00);
    setPuntuacionParcial(doc.puntuacion_respuesta_parcial || 0.80);
    setPuntuacionMinima(doc.puntuacion_respuesta_minima || 0.40);
    setUmbralParcial(doc.umbral_respuesta_parcial || 0.30);
    setTiempoRespuesta(doc.tiempo_respuesta_segundos || 60);
    setRolesAsignados(doc.roles_asignados || ['admin', 'mentor', 'estudiante', 'coordinador']);
    setModoConsulta(doc.modo_consulta !== undefined ? !!parseInt(doc.modo_consulta) : true);
    setModoMentor(doc.modo_mentor !== undefined ? !!parseInt(doc.modo_mentor) : true);
    setModoEvaluacion(doc.modo_evaluacion !== undefined ? !!parseInt(doc.modo_evaluacion) : true);
    setModoReto(doc.modo_reto !== undefined ? !!parseInt(doc.modo_reto) : true);
    setImagenFile(null);
    setImagenPreview(doc.imagen ? `${BACKEND_BASE}/${doc.imagen}` : null);
    setSavedDocId(null);
    setBloques([]);
    setResumenDoc('');
    setBloquesExpandidos({});
    setMensaje('');
    setError('');
    setActiveTab('general');
    setVista('form');
    // Cargar bloques del documento
    cargarBloques(doc.id);
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Seguro que deseas eliminar este documento?')) {
      try {
        await consultaService.deleteDocumento(id);
        cargarDocumentos();
      } catch (err) {
        setError('Error al eliminar el documento.');
      }
    }
  };

  const handleNuevo = () => {
    setEditingDoc(null);
    setTitulo('');
    setDescripcion('');
    setContenido('');
    setPreguntasEvaluacion(10);
    setPorcentajeAprobacion(60);
    setTieneCertificado(false);
    setMaxIntentos(3);
    setPuntuacionCompleta(1.00);
    setPuntuacionParcial(0.80);
    setPuntuacionMinima(0.40);
    setUmbralParcial(0.30);
    setTiempoRespuesta(60);
    setRolesAsignados(['admin', 'mentor', 'estudiante', 'coordinador']);
    setModoConsulta(true);
    setModoMentor(true);
    setModoEvaluacion(true);
    setModoReto(true);
    setImagenFile(null);
    setImagenPreview(null);
    setSavedDocId(null);
    setBloques([]);
    setResumenDoc('');
    setBloquesExpandidos({});
    setShowPreview(false);
    setMensaje('');
    setError('');
    setActiveTab('general');
    setVista('form');
  };

  const handleVolverLista = () => {
    setVista('list');
    setMensaje('');
    setError('');
  };

  // Obtener el ID del documento para AttachmentManager
  const getDocIdForAttachments = () => {
    if (editingDoc) return editingDoc.id;
    if (savedDocId) return savedDocId;
    return null;
  };

  // ========= VISTA: LISTA DE DOCUMENTOS =========
  if (vista === 'list') {
    return (
      <div style={embedded ? {} : styles.container}>
        <div style={styles.header}>
          <h2 style={{ margin: 0, color: '#2b4361' }}>Documentos</h2>
          <button onClick={handleNuevo} style={styles.btnPrimary}>
            + Nuevo Documento
          </button>
        </div>

        {mensaje && <div style={styles.alert('success')}>{mensaje}</div>}
        {error && <div style={styles.alert('error')}>{error}</div>}

        {documentos.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280', padding: '3rem' }}>No hay documentos registrados.</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {documentos.map((doc) => (
              <div key={doc.id} style={{
                backgroundColor: '#fff',
                padding: '1.25rem',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start'
              }}>
                {/* Thumbnail */}
                <div style={{
                  width: '120px', minWidth: '120px', height: '68px',
                  borderRadius: '6px', overflow: 'hidden', backgroundColor: '#f3f4f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {doc.imagen ? (
                    <img src={`${BACKEND_BASE}/${doc.imagen}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ fontSize: '1.05rem', color: '#2b4361' }}>{doc.titulo}</strong>
                      <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0.15rem 0 0.5rem' }}>{doc.descripcion || 'Sin descripcion'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                      <button onClick={() => handleEdit(doc)} style={styles.btnWarning}>Editar</button>
                      <button onClick={() => handleDelete(doc.id)} style={styles.btnDanger}>Eliminar</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#6b7280' }}>
                    <span>Preguntas: {doc.preguntas_por_evaluacion || 10}</span>
                    <span>Aprobacion: {doc.porcentaje_aprobacion || 60}%</span>
                    <span>Intentos: {doc.max_intentos || 3}</span>
                    {doc.tiene_certificado && <span style={{ color: '#059669' }}>Certificado</span>}
                  </div>
                  {doc.roles_asignados && doc.roles_asignados.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                      {doc.roles_asignados.map(r => (
                        <span key={r} style={styles.badge()}>{r}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ========= VISTA: FORMULARIO CON TABS =========
  const tabs = [
    { id: 'general', label: 'Informacion General' },
    { id: 'evaluacion', label: 'Evaluacion' },
    { id: 'bloques', label: `Bloques Tematicos${bloques.length ? ` (${bloques.length})` : ''}` },
    { id: 'anexos', label: 'Anexos y Media' }
  ];

  return (
    <div style={embedded ? {} : styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={{ margin: 0, color: '#2b4361' }}>
          {editingDoc ? `Editar: ${editingDoc.titulo}` : 'Nuevo Documento'}
        </h2>
        <button onClick={handleVolverLista} style={styles.btnSecondary}>
          &larr; Volver a lista
        </button>
      </div>

      {mensaje && <div style={styles.alert('success')}>{mensaje}</div>}
      {error && <div style={styles.alert('error')}>{error}</div>}

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem', display: 'flex', gap: '0.25rem' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={styles.tab(activeTab === tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Informacion General */}
      {activeTab === 'general' && (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.25rem' }}>Titulo:</label>
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} style={styles.input} required />
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.25rem' }}>Descripcion:</label>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} style={styles.textarea} />
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <label style={{ fontWeight: '600' }}>Contenido:</label>
              <button type="button" onClick={() => setShowPreview(!showPreview)} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '4px', padding: '0.25rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem', color: '#6b7280' }}>
                {showPreview ? 'Editar' : 'Vista previa'}
              </button>
            </div>
            {showPreview ? (
              <div style={{
                ...styles.section,
                minHeight: '200px',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6',
                fontSize: '0.95rem'
              }}>
                {contenido || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Sin contenido</span>}
              </div>
            ) : (
              <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={10} style={{ ...styles.textarea, minHeight: '200px' }} />
            )}
          </div>

          {/* Imagen destacada */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.25rem' }}>Imagen destacada:</label>
            {imagenPreview && (
              <div style={{ marginBottom: '0.5rem' }}>
                <img src={imagenPreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', objectFit: 'cover' }} />
              </div>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  setImagenFile(file);
                  setImagenPreview(URL.createObjectURL(file));
                }
              }}
              style={{ padding: '0.4rem 0' }}
            />
            <br />
            <small style={{ color: '#6b7280' }}>JPEG, PNG o WebP. Max 2MB. Proporcion 16:9 recomendada.</small>
          </div>

          {/* Roles de acceso */}
          <div style={styles.section}>
            <h3 style={{ margin: '0 0 0.75rem 0', color: '#2b4361', fontSize: '1rem' }}>Roles de acceso</h3>
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
              {rolesDisponibles.map((r) => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                  <input
                    type="checkbox"
                    checked={rolesAsignados.includes(r)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setRolesAsignados([...rolesAsignados, r]);
                      } else {
                        setRolesAsignados(rolesAsignados.filter(role => role !== r));
                      }
                    }}
                    style={{ accentColor: '#0891B2', width: '16px', height: '16px' }}
                  />
                  <span style={{ textTransform: 'capitalize' }}>{r}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Modos de Aprendizaje */}
          <div style={{ ...styles.section, borderColor: '#bfdbfe', backgroundColor: '#f0f9ff' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#2b4361', fontSize: '1rem' }}>Modos de Aprendizaje</h3>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 0.75rem 0' }}>
              Selecciona qué modos estarán disponibles para los estudiantes en este documento.
            </p>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              {[
                { key: 'consulta', label: '💬 Consulta', state: modoConsulta, setter: setModoConsulta },
                { key: 'mentor', label: '👨‍🏫 Mentor', state: modoMentor, setter: setModoMentor },
                { key: 'evaluacion', label: '📝 Evaluación', state: modoEvaluacion, setter: setModoEvaluacion },
                { key: 'reto', label: '🎯 Reto Semanal', state: modoReto, setter: setModoReto }
              ].map(modo => (
                <label key={modo.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                  <input
                    type="checkbox"
                    checked={modo.state}
                    onChange={(e) => modo.setter(e.target.checked)}
                    style={{ accentColor: '#0891B2', width: '16px', height: '16px' }}
                  />
                  <span>{modo.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="submit" style={styles.btnPrimary}>
              {editingDoc ? 'Actualizar Documento' : 'Guardar Documento'}
            </button>
            <button type="button" onClick={handleVolverLista} style={{ ...styles.btnSecondary, backgroundColor: '#6b7280' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Evaluacion */}
      {activeTab === 'evaluacion' && (
        <form onSubmit={handleSubmit}>
          <div style={styles.section}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2b4361' }}>Configuracion de Evaluacion</h3>
            <div style={styles.grid2}>
              <div>
                <label style={{ fontWeight: '500' }}>Preguntas por evaluacion:</label>
                <input type="number" min="1" max="50" value={preguntasEvaluacion} onChange={(e) => setPreguntasEvaluacion(parseInt(e.target.value) || 10)} style={styles.input} />
                <small style={{ color: '#6b7280' }}>Entre 1 y 50 preguntas</small>
              </div>
              <div>
                <label style={{ fontWeight: '500' }}>Porcentaje de aprobacion (%):</label>
                <input type="number" min="1" max="100" value={porcentajeAprobacion} onChange={(e) => setPorcentajeAprobacion(parseFloat(e.target.value) || 60)} style={styles.input} />
                <small style={{ color: '#6b7280' }}>Entre 1% y 100%</small>
              </div>
              <div>
                <label style={{ fontWeight: '500' }}>Maximo de intentos:</label>
                <input type="number" min="1" max="10" value={maxIntentos} onChange={(e) => setMaxIntentos(parseInt(e.target.value) || 3)} style={styles.input} />
                <small style={{ color: '#6b7280' }}>Entre 1 y 10 intentos</small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
                <input type="checkbox" id="tiene_certificado" checked={tieneCertificado} onChange={(e) => setTieneCertificado(e.target.checked)} style={{ accentColor: '#0891B2', width: '16px', height: '16px' }} />
                <label htmlFor="tiene_certificado" style={{ fontWeight: '500' }}>Genera certificado al aprobar</label>
              </div>
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2b4361' }}>Configuracion Avanzada de Puntuacion</h3>
            <div style={styles.grid3}>
              <div>
                <label style={{ fontWeight: '500' }}>Puntuacion completa:</label>
                <input type="number" min="0.1" max="1.0" step="0.01" value={puntuacionCompleta} onChange={(e) => setPuntuacionCompleta(parseFloat(e.target.value) || 1.00)} style={styles.input} />
                <small style={{ color: '#6b7280' }}>Respuesta 100% correcta</small>
              </div>
              <div>
                <label style={{ fontWeight: '500' }}>Puntuacion parcial:</label>
                <input type="number" min="0.1" max="1.0" step="0.01" value={puntuacionParcial} onChange={(e) => setPuntuacionParcial(parseFloat(e.target.value) || 0.80)} style={styles.input} />
                <small style={{ color: '#6b7280' }}>Respuesta parcialmente correcta</small>
              </div>
              <div>
                <label style={{ fontWeight: '500' }}>Puntuacion minima:</label>
                <input type="number" min="0.1" max="1.0" step="0.01" value={puntuacionMinima} onChange={(e) => setPuntuacionMinima(parseFloat(e.target.value) || 0.40)} style={styles.input} />
                <small style={{ color: '#6b7280' }}>Conocimiento basico</small>
              </div>
              <div>
                <label style={{ fontWeight: '500' }}>Umbral respuesta parcial:</label>
                <input type="number" min="0.1" max="1.0" step="0.01" value={umbralParcial} onChange={(e) => setUmbralParcial(parseFloat(e.target.value) || 0.30)} style={styles.input} />
                <small style={{ color: '#6b7280' }}>Similitud para parcial</small>
              </div>
              <div>
                <label style={{ fontWeight: '500' }}>Tiempo de respuesta (seg):</label>
                <input type="number" min="10" max="300" value={tiempoRespuesta} onChange={(e) => setTiempoRespuesta(parseInt(e.target.value) || 60)} style={styles.input} />
                <small style={{ color: '#6b7280' }}>Entre 10 y 300 segundos</small>
              </div>
            </div>
          </div>

          <button type="submit" style={styles.btnPrimary}>
            {editingDoc ? 'Actualizar Documento' : 'Guardar Documento'}
          </button>
        </form>
      )}

      {/* Tab 3: Bloques Temáticos */}
      {activeTab === 'bloques' && (
        <div>
          {/* Info */}
          <div style={{ ...styles.section, backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e40af' }}>
              Los bloques tematicos permiten que MentorIA acceda al contenido completo del documento durante las sesiones de voz,
              sin importar el tamano. El documento se divide en secciones y la IA consulta cada bloque cuando lo necesita.
            </p>
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => generarBloques(getDocIdForAttachments())}
              disabled={generandoBloques || !getDocIdForAttachments()}
              style={{
                ...styles.btnPrimary,
                opacity: (generandoBloques || !getDocIdForAttachments()) ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}
            >
              {generandoBloques ? (
                <>
                  <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  Analizando con IA...
                </>
              ) : (
                bloques.length > 0 ? 'Regenerar Bloques' : 'Generar Bloques con IA'
              )}
            </button>

            {bloques.length > 0 && (
              <button onClick={() => eliminarBloques(getDocIdForAttachments())} style={styles.btnDanger}>
                Eliminar Bloques
              </button>
            )}

            {!getDocIdForAttachments() && (
              <span style={{ color: '#6b7280', fontSize: '0.9rem', alignSelf: 'center' }}>
                Guarda el documento primero para generar bloques.
              </span>
            )}
          </div>

          {/* Resumen */}
          {resumenDoc && (
            <div style={{ ...styles.section, marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', color: '#2b4361', fontSize: '1rem' }}>
                Resumen Ejecutivo (usado como contexto en voz)
              </h3>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: '1.6', color: '#374151', maxHeight: '300px', overflowY: 'auto' }}>
                {resumenDoc}
              </div>
            </div>
          )}

          {/* Lista de bloques */}
          {bloques.length > 0 ? (
            <div>
              <h3 style={{ color: '#2b4361', marginBottom: '0.75rem' }}>
                {bloques.length} Bloques ({bloques.reduce((sum, b) => sum + (b.tokens_estimados || 0), 0).toLocaleString()} tokens total)
              </h3>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {bloques.map((bloque) => (
                  <div key={bloque.id || bloque.orden} style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: '#fff'
                  }}>
                    {/* Header del bloque */}
                    <div
                      onClick={async () => {
                        const isExpanded = bloquesExpandidos[bloque.orden];
                        setBloquesExpandidos(prev => ({ ...prev, [bloque.orden]: !isExpanded }));
                        // Lazy load contenido si no lo tiene
                        if (!isExpanded && !bloque.contenido && bloque.id) {
                          try {
                            const res = await axios.get(`${BACKEND_BASE}/api/documento-bloques.php`, {
                              params: { documento_id: getDocIdForAttachments(), bloque_id: bloque.id },
                              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                            });
                            if (res.data?.success && res.data.bloque) {
                              setBloques(prev => prev.map(b => b.id === bloque.id ? { ...b, contenido: res.data.bloque.contenido } : b));
                            }
                          } catch (err) { console.error('Error cargando contenido del bloque:', err); }
                        }
                      }}
                      style={{
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: bloquesExpandidos[bloque.orden] ? '#f0fdfa' : '#fff',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          backgroundColor: '#0891B2', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.8rem', fontWeight: '700', flexShrink: 0
                        }}>
                          {bloque.orden}
                        </span>
                        <div>
                          <strong style={{ fontSize: '0.95rem', color: '#2b4361' }}>{bloque.titulo}</strong>
                          {bloque.resumen_bloque && (
                            <p style={{ margin: '0.15rem 0 0', fontSize: '0.82rem', color: '#6b7280' }}>
                              {bloque.resumen_bloque.length > 120 ? bloque.resumen_bloque.substring(0, 120) + '...' : bloque.resumen_bloque}
                            </p>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                          ~{(bloque.tokens_estimados || 0).toLocaleString()} tokens
                        </span>
                        <span style={{ color: '#9ca3af', fontSize: '1.2rem' }}>
                          {bloquesExpandidos[bloque.orden] ? '▼' : '▶'}
                        </span>
                      </div>
                    </div>

                    {/* Contenido expandido */}
                    {bloquesExpandidos[bloque.orden] && bloque.contenido && (
                      <div style={{
                        padding: '0.75rem 1rem',
                        borderTop: '1px solid #e5e7eb',
                        backgroundColor: '#f9fafb',
                        maxHeight: '400px',
                        overflowY: 'auto'
                      }}>
                        <pre style={{
                          whiteSpace: 'pre-wrap',
                          wordWrap: 'break-word',
                          fontSize: '0.85rem',
                          lineHeight: '1.5',
                          color: '#374151',
                          margin: 0,
                          fontFamily: 'inherit'
                        }}>
                          {bloque.contenido}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : !generandoBloques && getDocIdForAttachments() ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Sin bloques tematicos</p>
              <p>Presiona "Generar Bloques con IA" para analizar el contenido y crear bloques automaticamente.</p>
              <p style={{ fontSize: '0.85rem' }}>Esto permite que MentorIA acceda al documento completo durante las sesiones de voz.</p>
            </div>
          ) : null}

          {/* Spinner CSS */}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Tab 4: Anexos y Media */}
      {activeTab === 'anexos' && (
        <div>
          {getDocIdForAttachments() ? (
            <AttachmentManager
              documentId={getDocIdForAttachments()}
              onAttachmentChange={() => { cargarDocumentos(); }}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Guarda el documento primero</p>
              <p>Los anexos se pueden agregar una vez creado el documento. Ve a la pestaña "Informacion General" y guarda.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDocumentosPage;
