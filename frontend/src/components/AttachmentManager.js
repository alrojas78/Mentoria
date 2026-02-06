import React, { useState, useEffect, useCallback } from 'react';
import { attachmentService } from '../services/api';
import AttachmentPreview from './AttachmentPreview';

const AttachmentManager = ({ documentId, onAttachmentChange }) => {
  const [anexos, setAnexos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
const [uploadForm, setUploadForm] = useState({
  titulo: '',
  descripcion: '',
  keywords: '',
  transcripcion: ''
});

  // Cargar anexos del documento
  const loadAnexos = useCallback(async () => {
    if (!documentId) return;
    
    try {
      setLoading(true);
      const response = await attachmentService.getByDocument(documentId);
      setAnexos(response.data.data || []);
      setError('');
    } catch (err) {
      console.error('Error cargando anexos:', err);
      setError('Error al cargar anexos');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  // Cargar anexos al montar componente
  useEffect(() => {
    loadAnexos();
  }, [loadAnexos]);

  // Escuchar progreso de upload
  useEffect(() => {
    const handleUploadProgress = (event) => {
      setUploadProgress(event.detail.progress);
    };

    window.addEventListener('uploadProgress', handleUploadProgress);
    return () => window.removeEventListener('uploadProgress', handleUploadProgress);
  }, []);

  // Manejar drag & drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Manejar selección de archivo
  const handleFileSelect = (file) => {
    // Validar archivo
    const validation = attachmentService.validateFile(file);
    if (!validation.isValid) {
      setError(validation.errors.join(', '));
      return;
    }

    // Auto-generar título basado en nombre del archivo
    const autoTitulo = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, ' ');
    setUploadForm({
      titulo: autoTitulo,
      descripcion: '',
      keywords: ''
    });
    setShowUploadForm(true);
    setError('');
    
    // Guardar archivo para upload posterior
    window.selectedFile = file;
  };

  // Subir archivo
const handleUpload = async () => {
  // Verificar si es video de Vimeo (tiene URL en descripción pero no archivo)
  const esVideoVimeo = uploadForm.descripcion && 
    (uploadForm.descripcion.includes('vimeo.com') || uploadForm.descripcion.includes('player.vimeo.com'));
  
  if (!esVideoVimeo && !window.selectedFile) {
    setError('Se requiere archivo o enlace de Vimeo en la descripción');
    return;
  }
  
  if (!uploadForm.titulo.trim()) {
    setError('Se requiere título');
    return;
  }

  // ✅ NUEVA FUNCIÓN: Procesar transcripciones automáticamente
const processVideoTranscription = async (anexoResponse, file) => {
  try {
    console.log('📝 Verificando si hay transcripción para procesar...');
    console.log('📄 Archivo subido:', file?.name, 'Tipo:', file?.type);
    console.log('📋 Descripción:', uploadForm.descripcion);
    
    // 1. Detectar si es archivo de transcripción (.txt, .srt, .vtt)
    const esArchivoTranscripcion = file && (
      file.type === 'text/plain' || 
      file.name.endsWith('.txt') || 
      file.name.endsWith('.srt') || 
      file.name.endsWith('.vtt')
    );
    
    // 2. Detectar si hay transcripción en la descripción (formato texto con timestamps)
    const hayTranscripcionEnDescripcion = uploadForm.descripcion && 
      uploadForm.descripcion.match(/\d+:\d+:\d+\.\d+,\d+:\d+:\d+\.\d+/);
    
    if (esArchivoTranscripcion || hayTranscripcionEnDescripcion) {
      console.log('✅ Transcripción detectada, procesando...');
      
      let textoTranscripcion = '';
      let formato = 'texto';
      
      if (esArchivoTranscripcion) {
        // Leer contenido del archivo
        textoTranscripcion = await file.text();
        
        // Detectar formato
        if (textoTranscripcion.includes('-->')) {
          formato = 'srt';
        } else if (textoTranscripcion.match(/\d+:\d+:\d+\.\d+,\d+:\d+:\d+\.\d+/)) {
          formato = 'vimeo';
        }
        
        console.log('📝 Transcripción desde archivo, formato:', formato);
      } else if (hayTranscripcionEnDescripcion) {
        // Usar transcripción de la descripción
        textoTranscripcion = uploadForm.descripcion;
        formato = 'vimeo';
        console.log('📝 Transcripción desde descripción, formato:', formato);
      }
      
      // 3. Buscar video asociado con este anexo
      const anexoId = anexoResponse.data?.anexo_id || anexoResponse.data?.id;
      
      if (anexoId) {
        console.log('🔍 Buscando video para anexo:', anexoId);
        
        try {
          const videoResponse = await fetch(`/backend/api/consulta.php?action=get_video_by_anexo&anexo_id=${anexoId}`);
          const videoData = await videoResponse.json();
          
          if (videoData.success && videoData.video_id) {
            console.log('🎬 Video encontrado:', videoData.video_id);
            
            // 4. Guardar transcripción
            const transcripcionResponse = await fetch('/backend/api/video-transcripciones.php?action=save', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                video_id: videoData.video_id,
                transcripcion: textoTranscripcion,
                formato: formato
              })
            });
            
            if (transcripcionResponse.ok) {
              const result = await transcripcionResponse.json();
              console.log('✅ Transcripción guardada:', result);
              
              // Mostrar mensaje de éxito
              setError(''); // Limpiar errores
              // Si tienes una función para mostrar mensajes de éxito, úsala aquí
              console.log('🎉 Transcripción procesada correctamente:', result.caracteres_procesados, 'caracteres');
            } else {
              console.error('❌ Error guardando transcripción');
            }
            
          } else {
            console.log('⚠️ No se encontró video asociado al anexo');
          }
        } catch (videoError) {
          console.error('❌ Error buscando video:', videoError);
        }
      }
    } else {
      console.log('ℹ️ No se detectó transcripción en este anexo');
    }
    
  } catch (error) {
    console.error('❌ Error procesando transcripción:', error);
  }
};

    try {
      setUploading(true);
      setUploadProgress(0);
      
await attachmentService.upload(
  documentId,
  window.selectedFile || null, // Permitir null para videos de Vimeo
  uploadForm.titulo,
  uploadForm.descripcion,
  uploadForm.keywords,
  uploadForm.transcripcion // Agregar transcripción
);

// ✅ PROCESAR TRANSCRIPCIÓN SI EXISTE
if (window.selectedFile || uploadForm.descripcion) {
  // Simular respuesta con ID del anexo recién creado
  // Nota: Necesitarás ajustar esto según lo que devuelva tu attachmentService.upload
  const anexoResponse = { data: { anexo_id: Date.now() } }; // Placeholder
  
  await processVideoTranscription(anexoResponse, window.selectedFile);
}

      // Limpiar formulario
      setUploadForm({ titulo: '', descripcion: '', keywords: '' });
      setShowUploadForm(false);
      window.selectedFile = null;
      
      // Recargar anexos
      await loadAnexos();
      
      // Notificar cambio
      if (onAttachmentChange) {
        onAttachmentChange();
      }

      setError('');
    } catch (err) {
      console.error('Error subiendo archivo:', err);
      setError('Error al subir archivo: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Eliminar anexo
  const handleDelete = async (anexoId) => {
    if (!window.confirm('¿Estás seguro de eliminar este anexo?')) {
      return;
    }

    try {
      await attachmentService.delete(anexoId, false); // Soft delete
      await loadAnexos();
      
      if (onAttachmentChange) {
        onAttachmentChange();
      }
    } catch (err) {
      console.error('Error eliminando anexo:', err);
      setError('Error al eliminar anexo');
    }
  };

  // Actualizar anexo
  const handleUpdate = async (anexoId, updateData) => {
    try {
      await attachmentService.update({ id: anexoId, ...updateData });
      await loadAnexos();
      
      if (onAttachmentChange) {
        onAttachmentChange();
      }
    } catch (err) {
      console.error('Error actualizando anexo:', err);
      setError('Error al actualizar anexo');
    }
  };

  if (!documentId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        Selecciona un documento para gestionar sus anexos
      </div>
    );
  }

  return (
    <div style={{ 
      border: '1px solid #e5e7eb', 
      borderRadius: '8px', 
      padding: '1.5rem',
      backgroundColor: '#f9fafb'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, color: '#2b4361' }}>
          📎 Anexos Multimedia ({anexos.length})
        </h3>
        
        {!showUploadForm && (
          <button
            onClick={() => setShowUploadForm(true)}
            style={{
              backgroundColor: '#10B981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}
          >
            + Agregar Anexo
          </button>
        )}
      </div>

      {error && (
        <div style={{ 
          backgroundColor: '#fef2f2', 
          color: '#dc2626', 
          padding: '0.75rem', 
          borderRadius: '6px', 
          marginBottom: '1rem',
          fontSize: '0.9rem'
        }}>
          {error}
        </div>
      )}

      {/* Formulario de Upload */}
      {showUploadForm && (
        <div style={{ 
          border: '2px dashed #d1d5db', 
          borderRadius: '8px', 
          padding: '1.5rem', 
          marginBottom: '1.5rem',
          backgroundColor: 'white'
        }}>
          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragOver ? '#2b4361' : '#d1d5db'}`,
              borderRadius: '8px',
              padding: '2rem',
              textAlign: 'center',
              backgroundColor: dragOver ? '#f0f9ff' : '#f9fafb',
              marginBottom: '1rem',
              cursor: 'pointer'
            }}
            onClick={() => document.getElementById('fileInput').click()}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
              {window.selectedFile ? '✅' : '📁'}
            </div>
            <p style={{ margin: 0, color: '#6b7280' }}>
              {window.selectedFile ? 
                `Archivo seleccionado: ${window.selectedFile.name}` :
                'Arrastra un archivo aquí o haz clic para seleccionar'
              }
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>
              Máximo 5MB • JPG, PNG, GIF, WebP, PDF
            </p>
          </div>

          <input
            id="fileInput"
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])}
            style={{ display: 'none' }}
          />

          {/* Formulario de metadatos */}
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Título *
              </label>
              <input
                type="text"
                value={uploadForm.titulo}
                onChange={(e) => setUploadForm({ ...uploadForm, titulo: e.target.value })}
                placeholder="Título descriptivo del anexo"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Descripción
              </label>
              <textarea
                value={uploadForm.descripcion}
                onChange={(e) => setUploadForm({ ...uploadForm, descripcion: e.target.value })}
                placeholder="Descripción detallada del contenido"
                rows="3"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Palabras Clave
              </label>
              <input
                type="text"
                value={uploadForm.keywords}
                onChange={(e) => setUploadForm({ ...uploadForm, keywords: e.target.value })}
                placeholder="palabra1, palabra2, palabra3"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              />
              <small style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                Separadas por comas. Ayudan a la IA a encontrar el anexo automáticamente.
              </small>
            </div>
          </div>

          {/* AGREGAR ESTE BLOQUE después del campo Keywords */}
<div>
  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
    Transcripción (Opcional)
  </label>
  <textarea
    value={uploadForm.transcripcion || ''}
    onChange={(e) => setUploadForm({ ...uploadForm, transcripcion: e.target.value })}
    placeholder="Pega aquí la transcripción del video con timestamps&#10;Formato: 0:00:02.520,0:00:08.400 texto del video"
    rows="4"
    style={{
      width: '100%',
      padding: '0.5rem',
      border: '1px solid #d1d5db',
      borderRadius: '4px',
      resize: 'vertical',
      fontSize: '0.8rem'
    }}
  />
  <small style={{ color: '#6b7280', fontSize: '0.7rem' }}>
    Para videos: Copia y pega la transcripción con timestamps desde Vimeo
  </small>
</div>
          {/* Progress bar */}
          {uploading && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ 
                backgroundColor: '#e5e7eb', 
                borderRadius: '4px', 
                height: '8px',
                overflow: 'hidden'
              }}>
                <div style={{
                  backgroundColor: '#10B981',
                  height: '100%',
                  width: `${uploadProgress}%`,
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
                Subiendo... {uploadProgress}%
              </p>
            </div>
          )}

          {/* Botones */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              onClick={handleUpload}
              disabled={uploading || !uploadForm.titulo.trim() || 
  (!window.selectedFile && !(uploadForm.descripcion && 
    (uploadForm.descripcion.includes('vimeo.com') || uploadForm.descripcion.includes('player.vimeo.com'))))}
              style={{
                backgroundColor: uploading ? '#9ca3af' : '#2b4361',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.75rem 1.5rem',
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontWeight: '500'
              }}
            >
              {uploading ? 'Subiendo...' : 'Subir Anexo'}
            </button>
            
            <button
              onClick={() => {
                setShowUploadForm(false);
                setUploadForm({ titulo: '', descripcion: '', keywords: '', transcripcion: '' });
                window.selectedFile = null;
              }}
              disabled={uploading}
              style={{
                backgroundColor: 'white',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                padding: '0.75rem 1.5rem',
                cursor: uploading ? 'not-allowed' : 'pointer'
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de anexos */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
          Cargando anexos...
        </div>
      ) : anexos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
          No hay anexos para este documento.
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
          gap: '1rem' 
        }}>
          {anexos.map(anexo => (
            <AttachmentPreview
              key={anexo.id}
              anexo={anexo}
              onDelete={() => handleDelete(anexo.id)}
              onUpdate={(updateData) => handleUpdate(anexo.id, updateData)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AttachmentManager;