import React, { useState } from 'react';
import { attachmentService } from '../services/api';

const AttachmentPreview = ({ anexo, onDelete, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    titulo: anexo.titulo,
    descripcion: anexo.descripcion,
    keywords: anexo.keywords
  });
  const [showModal, setShowModal] = useState(false);

  // Iconos por tipo de archivo
  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'image': return '🖼️';
      case 'document': return '📄';
      case 'video': return '🎥';
      case 'audio': return '🎵';
      default: return '📎';
    }
  };

  // Formatear tamaño de archivo
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Guardar cambios
  const handleSave = () => {
    onUpdate(editForm);
    setEditing(false);
  };

  // Cancelar edición
  const handleCancel = () => {
    setEditForm({
      titulo: anexo.titulo,
      descripcion: anexo.descripcion,
      keywords: anexo.keywords
    });
    setEditing(false);
  };

  // Descargar archivo
  const handleDownload = () => {
    attachmentService.download(anexo.id);
  };

  return (
    <>
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        backgroundColor: 'white',
        overflow: 'hidden',
        transition: 'all 0.2s ease'
      }}>
        {/* Preview del archivo */}
        <div 
          style={{
            height: '150px',
            backgroundColor: '#f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            cursor: anexo.file_type === 'image' ? 'pointer' : 'default'
          }}
          onClick={() => anexo.file_type === 'image' && setShowModal(true)}
        >
          {anexo.file_type === 'image' && anexo.thumbnail_url ? (
            <img
              src={anexo.thumbnail_url}
              alt={anexo.titulo}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'cover'
              }}
            />
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                {getFileIcon(anexo.file_type)}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                {anexo.file_type.toUpperCase()}
              </div>
            </div>
          )}
          
          {/* Indicador de tipo en esquina */}
          <div style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '0.25rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.7rem'
          }}>
            {anexo.file_type}
          </div>
        </div>

        {/* Información del archivo */}
        <div style={{ padding: '1rem' }}>
          {editing ? (
            // Modo edición
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <input
                type="text"
                value={editForm.titulo}
                onChange={(e) => setEditForm({ ...editForm, titulo: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.9rem'
                }}
                placeholder="Título"
              />
              
              <textarea
                value={editForm.descripcion}
                onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })}
                rows="2"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  resize: 'vertical'
                }}
                placeholder="Descripción"
              />
              
              <input
                type="text"
                value={editForm.keywords}
                onChange={(e) => setEditForm({ ...editForm, keywords: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.8rem'
                }}
                placeholder="palabra1, palabra2"
              />
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleSave}
                  style={{
                    flex: 1,
                    backgroundColor: '#10B981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  Guardar
                </button>
                <button
                  onClick={handleCancel}
                  style={{
                    flex: 1,
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            // Modo visualización
            <>
              <h4 style={{
                margin: '0 0 0.5rem 0',
                fontSize: '1rem',
                fontWeight: '600',
                color: '#1f2937',
                lineHeight: '1.2'
              }}>
                {anexo.titulo}
              </h4>
              
              {anexo.descripcion && (
                <p style={{
                  margin: '0 0 0.75rem 0',
                  fontSize: '0.8rem',
                  color: '#6b7280',
                  lineHeight: '1.3'
                }}>
                  {anexo.descripcion}
                </p>
              )}
              
              {anexo.keywords && (
                <div style={{ marginBottom: '0.75rem' }}>
                  {anexo.keywords.split(',').map((keyword, index) => (
                    <span
                      key={index}
                      style={{
                        display: 'inline-block',
                        backgroundColor: '#e5e7eb',
                        color: '#374151',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        marginRight: '0.25rem',
                        marginBottom: '0.25rem'
                      }}
                    >
                      {keyword.trim()}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Metadatos */}
              <div style={{
                fontSize: '0.75rem',
                color: '#9ca3af',
                marginBottom: '0.75rem'
              }}>
                <div>{formatFileSize(anexo.file_size_bytes)}</div>
                {anexo.metadata && anexo.metadata.resolution && (
                  <div>{anexo.metadata.resolution}</div>
                )}
                <div>Subido: {new Date(anexo.created_at).toLocaleDateString()}</div>
              </div>
              
              {/* Botones de acción */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => setEditing(true)}
                  style={{
                    flex: 1,
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    minWidth: '70px'
                  }}
                >
                  ✏️ Editar
                </button>
                
                <button
                  onClick={handleDownload}
                  style={{
                    flex: 1,
                    backgroundColor: '#2b4361',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    minWidth: '70px'
                  }}
                >
                  📥 Descargar
                </button>
                
                <button
                  onClick={onDelete}
                  style={{
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    minWidth: '40px'
                  }}
                >
                  🗑️
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal para vista ampliada (solo imágenes) */}
      {showModal && anexo.file_type === 'image' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem'
          }}
          onClick={() => setShowModal(false)}
        >
          <div
           style={{
             position: 'relative',
             maxWidth: '90%',
             maxHeight: '90%',
             backgroundColor: 'white',
             borderRadius: '8px',
             overflow: 'hidden'
           }}
           onClick={(e) => e.stopPropagation()}
         >
           <img
             src={anexo.public_url}
             alt={anexo.titulo}
             style={{
               width: '100%',
               height: 'auto',
               display: 'block'
             }}
           />
           
           <div style={{
             position: 'absolute',
             top: '1rem',
             right: '1rem',
             backgroundColor: 'rgba(0, 0, 0, 0.7)',
             color: 'white',
             border: 'none',
             borderRadius: '50%',
             width: '40px',
             height: '40px',
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'center',
             cursor: 'pointer',
             fontSize: '1.5rem'
           }}>
             <button
               onClick={() => setShowModal(false)}
               style={{
                 background: 'none',
                 border: 'none',
                 color: 'white',
                 cursor: 'pointer',
                 fontSize: '1.5rem'
               }}
             >
               ×
             </button>
           </div>
           
           <div style={{
             position: 'absolute',
             bottom: 0,
             left: 0,
             right: 0,
             backgroundColor: 'rgba(0, 0, 0, 0.7)',
             color: 'white',
             padding: '1rem'
           }}>
             <h3 style={{ margin: '0 0 0.5rem 0' }}>{anexo.titulo}</h3>
             {anexo.descripcion && (
               <p style={{ margin: 0, fontSize: '0.9rem' }}>{anexo.descripcion}</p>
             )}
           </div>
         </div>
       </div>
     )}
   </>
 );
};

export default AttachmentPreview;