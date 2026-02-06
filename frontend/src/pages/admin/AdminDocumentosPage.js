import React, { useState, useEffect } from 'react';
import { consultaService } from '../../services/api';
import AttachmentManager from '../../components/AttachmentManager';

const ROLES_DISPONIBLES = ['admin', 'mentor', 'estudiante', 'coordinador'];
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

const AdminDocumentosPage = () => {
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

  // Roles e imagen
  const [rolesAsignados, setRolesAsignados] = useState(['admin', 'mentor', 'estudiante', 'coordinador']);
  const [imagenFile, setImagenFile] = useState(null);
  const [imagenPreview, setImagenPreview] = useState(null);

  // ID temporal para AttachmentManager en documentos recién creados
  const [savedDocId, setSavedDocId] = useState(null);

  useEffect(() => { cargarDocumentos(); }, []);

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
          roles: rolesAsignados
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
    setImagenFile(null);
    setImagenPreview(doc.imagen ? `${BACKEND_BASE}/${doc.imagen}` : null);
    setSavedDocId(null);
    setMensaje('');
    setError('');
    setActiveTab('general');
    setVista('form');
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
    setImagenFile(null);
    setImagenPreview(null);
    setSavedDocId(null);
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
      <div style={styles.container}>
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
    { id: 'anexos', label: 'Anexos y Media' }
  ];

  return (
    <div style={styles.container}>
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
              {ROLES_DISPONIBLES.map((r) => (
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

      {/* Tab 3: Anexos y Media */}
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
