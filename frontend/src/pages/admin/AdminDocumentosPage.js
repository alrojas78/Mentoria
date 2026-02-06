import React, { useState, useEffect } from 'react';
import { consultaService } from '../../services/api'; // ✅ Usa tu servicio centralizado
import AttachmentManager from '../../components/AttachmentManager';

const AdminDocumentosPage = () => {
  const [documentos, setDocumentos] = useState([]);
  const [editingDoc, setEditingDoc] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [contenido, setContenido] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
    const [preguntasEvaluacion, setPreguntasEvaluacion] = useState(10);
  const [porcentajeAprobacion, setPorcentajeAprobacion] = useState(60);
  const [tieneCertificado, setTieneCertificado] = useState(false);
  const [maxIntentos, setMaxIntentos] = useState(3);
  const [mostrarConfigEvaluacion, setMostrarConfigEvaluacion] = useState(false);

  const [puntuacionCompleta, setPuntuacionCompleta] = useState(1.00);
const [puntuacionParcial, setPuntuacionParcial] = useState(0.80);
const [puntuacionMinima, setPuntuacionMinima] = useState(0.40);
const [umbralParcial, setUmbralParcial] = useState(0.30);
const [tiempoRespuesta, setTiempoRespuesta] = useState(60);

const [rolesAsignados, setRolesAsignados] = useState(['admin', 'mentor', 'estudiante', 'coordinador']);
const ROLES_DISPONIBLES = ['admin', 'mentor', 'estudiante', 'coordinador'];
const BACKEND_BASE = 'https://mentoria.ateneo.co/backend';

const [imagenFile, setImagenFile] = useState(null);
const [imagenPreview, setImagenPreview] = useState(null);

  useEffect(() => {
    cargarDocumentos();
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
      setError('El título y el contenido son obligatorios');
      return;
    }

try {
      if (editingDoc) {

            // ✅ AGREGAR ESTAS LÍNEAS DE DEBUG
    console.log('🔄 EDITANDO documento');
    console.log('editingDoc:', editingDoc);
    console.log('editingDoc.id:', editingDoc.id);

        // Actualizar documento
        const updateData = {
          id: editingDoc.id,
          titulo: titulo,
          descripcion: descripcion,
          contenido: contenido,
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

console.log('📤 Datos a enviar:', updateData);

        await consultaService.updateDocumento(updateData);
        // Subir imagen si se seleccionó una nueva
        if (imagenFile) {
          await consultaService.uploadDocumentoImagen(editingDoc.id, imagenFile);
        }
        setMensaje('Documento actualizado correctamente.');
      } else {
        console.log('➕ CREANDO nuevo documento');
        // Crear documento
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

        await consultaService.createDocumento(formData);
        setMensaje('Documento creado correctamente.');
      }

      limpiarFormulario();
      cargarDocumentos();
    } catch (err) {
      setError('Error al guardar el documento.');
    }
  };

  const handleEdit = (doc) => {
    setEditingDoc(doc);
    setTitulo(doc.titulo);
    setDescripcion(doc.descripcion);
    setContenido(doc.contenido);
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
    setMostrarConfigEvaluacion(true);
    setMensaje('');
    setError('');
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

const limpiarFormulario = () => {
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
    setMostrarConfigEvaluacion(false);
    setMensaje('');
    setError('');
  };

  return (
    <div style={{ display: 'flex', padding: '2rem', gap: '2rem' }}>
      {/* Columna Izquierda - Formulario */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{editingDoc ? 'Editar Documento' : 'Nuevo Documento'}</h2>
          {editingDoc && (
            <button onClick={limpiarFormulario} style={{ backgroundColor: '#2b4361', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}>
              + Nuevo Documento
            </button>
          )}
          
        </div>

        {mensaje && <div style={{ padding: '1rem', backgroundColor: '#d4edda', marginBottom: '1rem' }}>{mensaje}</div>}
        {error && <div style={{ padding: '1rem', backgroundColor: '#f8d7da', marginBottom: '1rem' }}>{error}</div>}

 <form onSubmit={handleSubmit}>
          <div>
            <label>Título:</label>
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem' }} />
          </div>

          <div>
            <label>Descripción:</label>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem' }} />
          </div>

          <div>
            <label>Contenido:</label>
            <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} style={{ width: '100%', marginBottom: '1rem', minHeight: '150px', padding: '0.5rem' }} />
          </div>

          {/* Imagen destacada */}
          <div style={{ marginBottom: '1rem' }}>
            <label>Imagen destacada:</label>
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
              style={{ width: '100%', padding: '0.5rem' }}
            />
            <small style={{ color: '#666' }}>JPEG, PNG o WebP. Máximo 2MB. Proporción 16:9 recomendada.</small>
          </div>

          {/* Roles de acceso */}
          <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', backgroundColor: '#f8f9fa' }}>
            <h3 style={{ margin: '0 0 0.75rem 0', color: '#2b4361', fontSize: '1rem' }}>Roles de acceso</h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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
                    style={{ accentColor: '#0891B2' }}
                  />
                  <span style={{ textTransform: 'capitalize' }}>{r}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Configuración de Evaluación */}
          <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', backgroundColor: '#f8f9fa' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem', cursor: 'pointer' }} onClick={() => setMostrarConfigEvaluacion(!mostrarConfigEvaluacion)}>
              <h3 style={{ margin: 0, color: '#2b4361' }}>⚙️ Configuración de Evaluación</h3>
              <span style={{ marginLeft: '0.5rem' }}>{mostrarConfigEvaluacion ? '▼' : '▶'}</span>
            </div>
            
            {mostrarConfigEvaluacion && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label>Preguntas por evaluación:</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={preguntasEvaluacion}
                    onChange={(e) => setPreguntasEvaluacion(parseInt(e.target.value) || 10)}
                    style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
                  />
                  <small style={{ color: '#666' }}>Entre 1 y 50 preguntas</small>
                </div>

                <div>
                  <label>Porcentaje de aprobación (%):</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={porcentajeAprobacion}
                    onChange={(e) => setPorcentajeAprobacion(parseFloat(e.target.value) || 60)}
                    style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
                  />
                  <small style={{ color: '#666' }}>Entre 1% y 100%</small>
                </div>

                <div>
                  <label>Máximo de intentos:</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={maxIntentos}
                    onChange={(e) => setMaxIntentos(parseInt(e.target.value) || 3)}
                    style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
                  />
                  <small style={{ color: '#666' }}>Entre 1 y 10 intentos</small>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="tiene_certificado"
                    checked={tieneCertificado}
                    onChange={(e) => setTieneCertificado(e.target.checked)}
                  />
                  <label htmlFor="tiene_certificado">🏆 Genera certificado al aprobar</label>
                </div>
                {/* ✅ NUEVA SECCIÓN: Configuración Avanzada de Puntuación */}
                <div style={{ gridColumn: '1 / -1', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #ddd' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: '#2b4361', fontSize: '1rem' }}>⚙️ Configuración Avanzada de Puntuación</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    
                    <div>
                      <label>Puntuación completa:</label>
                      <input
                        type="number"
                        min="0.1"
                        max="1.0"
                        step="0.01"
                        value={puntuacionCompleta}
                        onChange={(e) => setPuntuacionCompleta(parseFloat(e.target.value) || 1.00)}
                        style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
                      />
                      <small style={{ color: '#666' }}>Respuesta 100% correcta</small>
                    </div>

                    <div>
                      <label>Puntuación parcial:</label>
                      <input
                        type="number"
                        min="0.1"
                        max="1.0"
                        step="0.01"
                        value={puntuacionParcial}
                        onChange={(e) => setPuntuacionParcial(parseFloat(e.target.value) || 0.80)}
                        style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
                      />
                      <small style={{ color: '#666' }}>Respuesta parcialmente correcta</small>
                    </div>

                    <div>
                      <label>Puntuación mínima:</label>
                      <input
                        type="number"
                        min="0.1"
                        max="1.0"
                        step="0.01"
                        value={puntuacionMinima}
                        onChange={(e) => setPuntuacionMinima(parseFloat(e.target.value) || 0.40)}
                        style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
                      />
                      <small style={{ color: '#666' }}>Conocimiento básico</small>
                    </div>

                    <div>
                      <label>Umbral respuesta parcial:</label>
                      <input
                        type="number"
                        min="0.1"
                        max="1.0"
                        step="0.01"
                        value={umbralParcial}
                        onChange={(e) => setUmbralParcial(parseFloat(e.target.value) || 0.30)}
                        style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
                      />
                      <small style={{ color: '#666' }}>Similitud para parcial</small>
                    </div>

                    <div>
                      <label>Tiempo de respuesta (seg):</label>
                      <input
                        type="number"
                        min="10"
                        max="300"
                        value={tiempoRespuesta}
                        onChange={(e) => setTiempoRespuesta(parseInt(e.target.value) || 60)}
                        style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
                      />
                      <small style={{ color: '#666' }}>Entre 10 y 300 segundos</small>
                    </div>

                  </div>
                </div>
              </div>
              
            )}
            
          </div>
          

          <button type="submit" style={{ backgroundColor: '#2b4361', color: '#fff', padding: '0.5rem 1rem', borderRadius: '4px' }}>
            {editingDoc ? 'Actualizar Documento' : 'Guardar Documento'}
          </button>
        </form>
              {/* ✅ POSICIÓN CORRECTA - Después del formulario */}
      {editingDoc && (
        <div style={{ marginTop: '2rem' }}>
          <AttachmentManager 
            documentId={editingDoc.id} 
            onAttachmentChange={() => {
              cargarDocumentos();
            }}
          />
        </div>
      )}
      </div>

      {/* Columna Derecha - Listado */}
      <div style={{ flex: 1 }}>
        <h2>Documentos Existentes</h2>
        {documentos.length === 0 ? (
          <p>No hay documentos registrados.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
           {documentos.map((doc) => (
  <li key={doc.id} style={{ 
    backgroundColor: '#fff', 
    padding: '1.5rem', 
    marginBottom: '1rem', 
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  }}>
    <div style={{ marginBottom: '0.75rem' }}>
      <strong style={{ fontSize: '1.1rem', color: '#2b4361' }}>{doc.titulo}</strong>
      <p style={{ fontSize: '0.9rem', color: '#6b7280', margin: '0.25rem 0' }}>{doc.descripcion}</p>
    </div>

    {/* Información de configuración de evaluación */}
    <div style={{ 
      backgroundColor: '#f3f4f6', 
      padding: '0.75rem', 
      borderRadius: '6px', 
      marginBottom: '1rem',
      fontSize: '0.85rem'
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
        <span><strong>📝 Preguntas:</strong> {doc.preguntas_por_evaluacion || 10}</span>
        <span><strong>📊 Aprobación:</strong> {doc.porcentaje_aprobacion || 60}%</span>
        <span><strong>🔄 Intentos:</strong> {doc.max_intentos || 3}</span>
        <span><strong>🏆 Certificado:</strong> {doc.tiene_certificado ? 'Sí' : 'No'}</span>
      </div>
      {doc.roles_asignados && (
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '0.85rem' }}>Roles:</strong>
          {doc.roles_asignados.map(r => (
            <span key={r} style={{
              backgroundColor: '#0891B2', color: '#fff', padding: '0.1rem 0.5rem',
              borderRadius: '12px', fontSize: '0.75rem', textTransform: 'capitalize'
            }}>{r}</span>
          ))}
        </div>
      )}
    </div>

    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <button 
        onClick={() => handleEdit(doc)} 
        style={{ 
          backgroundColor: '#f59e0b', 
          color: '#fff', 
          border: 'none', 
          borderRadius: '6px', 
          padding: '0.5rem 1rem', 
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: '500'
        }}
      >
        ✏️ Editar
      </button>
      <button 
        onClick={() => handleDelete(doc.id)} 
        style={{ 
          backgroundColor: '#ef4444', 
          color: '#fff', 
          border: 'none', 
          borderRadius: '6px', 
          padding: '0.5rem 1rem', 
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: '500'
        }}
      >
        🗑️ Eliminar
      </button>
    </div>
  </li>
))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminDocumentosPage;
