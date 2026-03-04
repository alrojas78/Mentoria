// GenericSectionForm.js — Formulario compartido para los tipos: feature_cards, icon_text_grid,
// text_block, image_gallery, cta_button, testimonials, custom_html
import React, { useState } from 'react';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import { proyectoService, BACKEND_BASE } from '../../../services/api';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  @media (max-width: 600px) { grid-template-columns: 1fr; }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  ${p => p.$full && 'grid-column: 1 / -1;'}
`;

const Label = styled.label`
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
`;

const Input = styled.input`
  padding: 0.5rem 0.7rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.88rem;
  &:focus { outline: none; border-color: #14b6cb; }
`;

const TextArea = styled.textarea`
  padding: 0.5rem 0.7rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.88rem;
  resize: vertical;
  min-height: 80px;
  &:focus { outline: none; border-color: #14b6cb; }
`;

const Select = styled.select`
  padding: 0.5rem 0.7rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.88rem;
  &:focus { outline: none; border-color: #14b6cb; }
`;

const ColorRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const ColorInput = styled.input`
  width: 40px;
  height: 32px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  padding: 2px;
`;

const ItemRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  padding: 0.6rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  flex-wrap: wrap;
`;

const SmallBtn = styled.button`
  background: none;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  width: 30px;
  height: 30px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  color: #475569;
  flex-shrink: 0;
  &:hover { border-color: #ef4444; color: #ef4444; }
`;

const AddBtn = styled.button`
  background: #f1f5f9;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  padding: 0.5rem;
  cursor: pointer;
  color: #64748b;
  font-size: 0.85rem;
  &:hover { border-color: #14b6cb; color: #14b6cb; }
`;

const ImgPreview = styled.img`
  height: 50px;
  object-fit: contain;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
`;

const GenericSectionForm = ({ config, onChange, tipo, proyectoId, seccionId }) => {
  const [uploading, setUploading] = useState(false);

  const set = (key, val) => onChange({ ...config, [key]: val });

  const handleUpload = async (file, field) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await proyectoService.uploadLandingImage(proyectoId, seccionId + '_' + field, file);
      if (res.data?.url) {
        set(field, res.data.url);
        toast.success('Imagen subida');
      }
    } catch (err) {
      toast.error('Error subiendo imagen');
    } finally {
      setUploading(false);
    }
  };

  const handleItemUpload = async (file, listKey, idx, fieldName) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await proyectoService.uploadLandingImage(proyectoId, `${seccionId}_${listKey}_${idx}`, file);
      if (res.data?.url) {
        const items = [...(config[listKey] || [])];
        items[idx] = { ...items[idx], [fieldName]: res.data.url };
        set(listKey, items);
        toast.success('Imagen subida');
      }
    } catch (err) {
      toast.error('Error subiendo imagen');
    } finally {
      setUploading(false);
    }
  };

  // ----- FEATURE CARDS -----
  if (tipo === 'feature_cards') {
    const cards = config.cards || [];
    const setCard = (idx, field, val) => {
      const n = [...cards];
      n[idx] = { ...n[idx], [field]: val };
      set('cards', n);
    };
    return (
      <Container>
        <Grid>
          <FormGroup $full>
            <Label>Título de la sección</Label>
            <Input value={config.titulo || ''} onChange={e => set('titulo', e.target.value)} placeholder="Herramientas Profesionales" />
          </FormGroup>
          <FormGroup>
            <Label>Color fondo</Label>
            <ColorRow>
              <ColorInput type="color" value={config.color_fondo || '#ffffff'} onChange={e => set('color_fondo', e.target.value)} />
              <Input value={config.color_fondo || ''} onChange={e => set('color_fondo', e.target.value)} style={{ width: 100 }} />
            </ColorRow>
          </FormGroup>
        </Grid>
        <Label>Tarjetas</Label>
        {cards.map((card, i) => (
          <ItemRow key={i}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Input value={card.titulo || ''} onChange={e => setCard(i, 'titulo', e.target.value)} placeholder="Título tarjeta" />
              <TextArea value={card.descripcion || ''} onChange={e => setCard(i, 'descripcion', e.target.value)} placeholder="Descripción" style={{ minHeight: 50 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Input type="file" accept="image/*" onChange={e => handleItemUpload(e.target.files[0], 'cards', i, 'imagen')} disabled={uploading} style={{ fontSize: '0.8rem' }} />
                {card.imagen && <ImgPreview src={card.imagen.startsWith('http') ? card.imagen : `${BACKEND_BASE}/${card.imagen}`} alt="" />}
              </div>
            </div>
            <SmallBtn onClick={() => set('cards', cards.filter((_, j) => j !== i))}>×</SmallBtn>
          </ItemRow>
        ))}
        <AddBtn onClick={() => set('cards', [...cards, { titulo: '', descripcion: '', imagen: '' }])}>+ Agregar tarjeta</AddBtn>
      </Container>
    );
  }

  // ----- ICON TEXT GRID -----
  if (tipo === 'icon_text_grid') {
    const items = config.items || [];
    const setItem = (idx, field, val) => {
      const n = [...items];
      n[idx] = { ...n[idx], [field]: val };
      set('items', n);
    };
    return (
      <Container>
        <Grid>
          <FormGroup>
            <Label>Columnas</Label>
            <Select value={config.columnas || 3} onChange={e => set('columnas', parseInt(e.target.value))}>
              <option value={2}>2 columnas</option>
              <option value={3}>3 columnas</option>
            </Select>
          </FormGroup>
          <FormGroup>
            <Label>Color fondo</Label>
            <ColorRow>
              <ColorInput type="color" value={config.color_fondo || '#ffffff'} onChange={e => set('color_fondo', e.target.value)} />
              <Input value={config.color_fondo || ''} onChange={e => set('color_fondo', e.target.value)} style={{ width: 100 }} />
            </ColorRow>
          </FormGroup>
        </Grid>
        <Label>Items (icono puede ser emoji, URL de imagen, o ruta relativa)</Label>
        {items.map((item, i) => (
          <ItemRow key={i}>
            <Input value={item.icono || ''} onChange={e => setItem(i, 'icono', e.target.value)} placeholder="📋 o URL" style={{ width: 100 }} />
            <Input value={item.texto || ''} onChange={e => setItem(i, 'texto', e.target.value)} placeholder="Texto del item" style={{ flex: 1 }} />
            <SmallBtn onClick={() => set('items', items.filter((_, j) => j !== i))}>×</SmallBtn>
          </ItemRow>
        ))}
        <AddBtn onClick={() => set('items', [...items, { icono: '', texto: '' }])}>+ Agregar item</AddBtn>
      </Container>
    );
  }

  // ----- TEXT BLOCK -----
  if (tipo === 'text_block') {
    return (
      <Container>
        <Grid>
          <FormGroup $full>
            <Label>Título</Label>
            <Input value={config.titulo || ''} onChange={e => set('titulo', e.target.value)} placeholder="Título del bloque" />
          </FormGroup>
          <FormGroup $full>
            <Label>Contenido (HTML permitido)</Label>
            <TextArea value={config.contenido || ''} onChange={e => set('contenido', e.target.value)} placeholder="<p>Texto aquí...</p>" style={{ minHeight: 120 }} />
          </FormGroup>
          <FormGroup>
            <Label>Alineación</Label>
            <Select value={config.alineacion || 'center'} onChange={e => set('alineacion', e.target.value)}>
              <option value="left">Izquierda</option>
              <option value="center">Centro</option>
              <option value="right">Derecha</option>
            </Select>
          </FormGroup>
          <FormGroup>
            <Label>Color fondo</Label>
            <ColorRow>
              <ColorInput type="color" value={config.color_fondo || '#ffffff'} onChange={e => set('color_fondo', e.target.value)} />
              <Input value={config.color_fondo || ''} onChange={e => set('color_fondo', e.target.value)} style={{ width: 100 }} />
            </ColorRow>
          </FormGroup>
          <FormGroup>
            <Label>Color título</Label>
            <ColorRow>
              <ColorInput type="color" value={config.color_titulo || '#0f355b'} onChange={e => set('color_titulo', e.target.value)} />
              <Input value={config.color_titulo || ''} onChange={e => set('color_titulo', e.target.value)} style={{ width: 100 }} />
            </ColorRow>
          </FormGroup>
          <FormGroup>
            <Label>Color texto</Label>
            <ColorRow>
              <ColorInput type="color" value={config.color_texto || '#333333'} onChange={e => set('color_texto', e.target.value)} />
              <Input value={config.color_texto || ''} onChange={e => set('color_texto', e.target.value)} style={{ width: 100 }} />
            </ColorRow>
          </FormGroup>
        </Grid>
      </Container>
    );
  }

  // ----- IMAGE GALLERY -----
  if (tipo === 'image_gallery') {
    const imagenes = config.imagenes || [];
    const setImg = (idx, field, val) => {
      const n = [...imagenes];
      n[idx] = { ...n[idx], [field]: val };
      set('imagenes', n);
    };
    return (
      <Container>
        <Grid>
          <FormGroup $full>
            <Label>Título</Label>
            <Input value={config.titulo || ''} onChange={e => set('titulo', e.target.value)} placeholder="Galería" />
          </FormGroup>
          <FormGroup>
            <Label>Columnas</Label>
            <Select value={config.columnas || 3} onChange={e => set('columnas', parseInt(e.target.value))}>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </Select>
          </FormGroup>
          <FormGroup>
            <Label>Color fondo</Label>
            <ColorRow>
              <ColorInput type="color" value={config.color_fondo || '#ffffff'} onChange={e => set('color_fondo', e.target.value)} />
              <Input value={config.color_fondo || ''} onChange={e => set('color_fondo', e.target.value)} style={{ width: 100 }} />
            </ColorRow>
          </FormGroup>
        </Grid>
        <Label>Imágenes</Label>
        {imagenes.map((img, i) => (
          <ItemRow key={i}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Input value={img.titulo || ''} onChange={e => setImg(i, 'titulo', e.target.value)} placeholder="Título" />
              <Input value={img.descripcion || ''} onChange={e => setImg(i, 'descripcion', e.target.value)} placeholder="Descripción" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Input type="file" accept="image/*" onChange={e => handleItemUpload(e.target.files[0], 'imagenes', i, 'url')} disabled={uploading} style={{ fontSize: '0.8rem' }} />
                {img.url && <ImgPreview src={img.url.startsWith('http') ? img.url : `${BACKEND_BASE}/${img.url}`} alt="" />}
              </div>
            </div>
            <SmallBtn onClick={() => set('imagenes', imagenes.filter((_, j) => j !== i))}>×</SmallBtn>
          </ItemRow>
        ))}
        <AddBtn onClick={() => set('imagenes', [...imagenes, { url: '', titulo: '', descripcion: '' }])}>+ Agregar imagen</AddBtn>
      </Container>
    );
  }

  // ----- CTA BUTTON -----
  if (tipo === 'cta_button') {
    return (
      <Container>
        <Grid>
          <FormGroup $full>
            <Label>Título</Label>
            <Input value={config.titulo || ''} onChange={e => set('titulo', e.target.value)} placeholder="¿Listo para comenzar?" />
          </FormGroup>
          <FormGroup $full>
            <Label>Subtítulo</Label>
            <Input value={config.subtitulo || ''} onChange={e => set('subtitulo', e.target.value)} placeholder="Únete a nuestra plataforma" />
          </FormGroup>
          <FormGroup>
            <Label>Texto del botón</Label>
            <Input value={config.texto_boton || ''} onChange={e => set('texto_boton', e.target.value)} placeholder="Comenzar ahora" />
          </FormGroup>
          <FormGroup>
            <Label>Acción</Label>
            <Select value={config.accion || 'registro'} onChange={e => set('accion', e.target.value)}>
              <option value="login">Abrir login</option>
              <option value="registro">Abrir registro</option>
              <option value="url">URL externa</option>
            </Select>
            {config.accion === 'url' && (
              <Input value={config.url || ''} onChange={e => set('url', e.target.value)} placeholder="https://..." style={{ marginTop: 4 }} />
            )}
          </FormGroup>
          <FormGroup>
            <Label>Color fondo sección</Label>
            <ColorRow>
              <ColorInput type="color" value={config.color_fondo || '#f8fafc'} onChange={e => set('color_fondo', e.target.value)} />
              <Input value={config.color_fondo || ''} onChange={e => set('color_fondo', e.target.value)} style={{ width: 100 }} />
            </ColorRow>
          </FormGroup>
          <FormGroup>
            <Label>Color botón</Label>
            <ColorRow>
              <ColorInput type="color" value={config.color_boton || '#14b6cb'} onChange={e => set('color_boton', e.target.value)} />
              <Input value={config.color_boton || ''} onChange={e => set('color_boton', e.target.value)} style={{ width: 100 }} />
            </ColorRow>
          </FormGroup>
        </Grid>
      </Container>
    );
  }

  // ----- TESTIMONIALS -----
  if (tipo === 'testimonials') {
    const items = config.items || [];
    const setItem = (idx, field, val) => {
      const n = [...items];
      n[idx] = { ...n[idx], [field]: val };
      set('items', n);
    };
    return (
      <Container>
        <Grid>
          <FormGroup $full>
            <Label>Título</Label>
            <Input value={config.titulo || ''} onChange={e => set('titulo', e.target.value)} placeholder="Lo que dicen nuestros estudiantes" />
          </FormGroup>
          <FormGroup>
            <Label>Color fondo</Label>
            <ColorRow>
              <ColorInput type="color" value={config.color_fondo || '#f8fafc'} onChange={e => set('color_fondo', e.target.value)} />
              <Input value={config.color_fondo || ''} onChange={e => set('color_fondo', e.target.value)} style={{ width: 100 }} />
            </ColorRow>
          </FormGroup>
        </Grid>
        <Label>Testimonios</Label>
        {items.map((item, i) => (
          <ItemRow key={i}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input value={item.nombre || ''} onChange={e => setItem(i, 'nombre', e.target.value)} placeholder="Nombre" style={{ flex: 1 }} />
                <Input value={item.cargo || ''} onChange={e => setItem(i, 'cargo', e.target.value)} placeholder="Cargo / Institución" style={{ flex: 1 }} />
              </div>
              <TextArea value={item.texto || ''} onChange={e => setItem(i, 'texto', e.target.value)} placeholder="Testimonio..." style={{ minHeight: 50 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Input type="file" accept="image/*" onChange={e => handleItemUpload(e.target.files[0], 'items', i, 'foto')} disabled={uploading} style={{ fontSize: '0.8rem' }} />
                {item.foto && <ImgPreview src={item.foto.startsWith('http') ? item.foto : `${BACKEND_BASE}/${item.foto}`} alt="" style={{ borderRadius: '50%', width: 40, height: 40 }} />}
              </div>
            </div>
            <SmallBtn onClick={() => set('items', items.filter((_, j) => j !== i))}>×</SmallBtn>
          </ItemRow>
        ))}
        <AddBtn onClick={() => set('items', [...items, { nombre: '', cargo: '', texto: '', foto: '' }])}>+ Agregar testimonio</AddBtn>
      </Container>
    );
  }

  // ----- CUSTOM HTML -----
  if (tipo === 'custom_html') {
    return (
      <Container>
        <FormGroup>
          <Label>HTML</Label>
          <TextArea value={config.html || ''} onChange={e => set('html', e.target.value)} placeholder="<div>Tu HTML aquí</div>" style={{ minHeight: 150, fontFamily: 'monospace' }} />
        </FormGroup>
        <FormGroup>
          <Label>CSS adicional (opcional)</Label>
          <TextArea value={config.css || ''} onChange={e => set('css', e.target.value)} placeholder="padding: 2rem; background: #f1f5f9;" style={{ minHeight: 60, fontFamily: 'monospace' }} />
        </FormGroup>
      </Container>
    );
  }

  // ----- HEADER -----
  if (tipo === 'header') {
    return (
      <Container>
        <Grid>
          <FormGroup>
            <Label>Logo (upload)</Label>
            <Input type="file" accept="image/*" onChange={e => handleUpload(e.target.files[0], 'logo')} disabled={uploading} />
            {config.logo && <ImgPreview src={config.logo.startsWith('http') ? config.logo : `${BACKEND_BASE}/${config.logo}`} alt="" />}
          </FormGroup>
          <FormGroup>
            <Label>Texto de marca</Label>
            <Input value={config.texto_marca || ''} onChange={e => set('texto_marca', e.target.value)} placeholder="MentorIA" />
          </FormGroup>
          <FormGroup>
            <Label>Color fondo</Label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="color" value={config.color_fondo || '#ffffff'} onChange={e => set('color_fondo', e.target.value)} style={{ width: 36, height: 30 }} />
              <Input value={config.color_fondo || ''} onChange={e => set('color_fondo', e.target.value)} style={{ width: 90 }} placeholder="#ffffff" />
            </div>
          </FormGroup>
          <FormGroup>
            <Label>Color texto</Label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="color" value={config.color_texto || '#0f355b'} onChange={e => set('color_texto', e.target.value)} style={{ width: 36, height: 30 }} />
              <Input value={config.color_texto || ''} onChange={e => set('color_texto', e.target.value)} style={{ width: 90 }} placeholder="#0f355b" />
            </div>
          </FormGroup>
          <FormGroup>
            <Label>Altura logo</Label>
            <Input value={config.altura_logo || ''} onChange={e => set('altura_logo', e.target.value)} placeholder="48px" />
          </FormGroup>
          <FormGroup>
            <Label>Tamaño marca</Label>
            <Input value={config.tamano_marca || ''} onChange={e => set('tamano_marca', e.target.value)} placeholder="1.3rem" />
          </FormGroup>
          <FormGroup>
            <Label>Padding</Label>
            <Input value={config.padding || ''} onChange={e => set('padding', e.target.value)} placeholder="0.75rem 2rem" />
          </FormGroup>
          <FormGroup>
            <Label>Sombra</Label>
            <Input value={config.sombra || ''} onChange={e => set('sombra', e.target.value)} placeholder="0 2px 8px rgba(0,0,0,0.06)" />
          </FormGroup>
        </Grid>
        <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={config.boton_login !== false} onChange={e => set('boton_login', e.target.checked)} /> Botón Login
          </label>
          <label style={{ display: 'flex', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={config.boton_registro !== false} onChange={e => set('boton_registro', e.target.checked)} /> Botón Registro
          </label>
        </div>
        <Grid>
          <FormGroup>
            <Label>Texto botón login</Label>
            <Input value={config.texto_boton_login || ''} onChange={e => set('texto_boton_login', e.target.value)} placeholder="Iniciar sesión" />
          </FormGroup>
          <FormGroup>
            <Label>Texto botón registro</Label>
            <Input value={config.texto_boton_registro || ''} onChange={e => set('texto_boton_registro', e.target.value)} placeholder="Registrarse" />
          </FormGroup>
          <FormGroup>
            <Label>Color botón registro</Label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="color" value={config.color_boton_registro || '#14b6cb'} onChange={e => set('color_boton_registro', e.target.value)} style={{ width: 36, height: 30 }} />
              <Input value={config.color_boton_registro || ''} onChange={e => set('color_boton_registro', e.target.value)} style={{ width: 90 }} />
            </div>
          </FormGroup>
          <FormGroup>
            <Label>Color texto botones</Label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="color" value={config.color_texto_botones || '#0f355b'} onChange={e => set('color_texto_botones', e.target.value)} style={{ width: 36, height: 30 }} />
              <Input value={config.color_texto_botones || ''} onChange={e => set('color_texto_botones', e.target.value)} style={{ width: 90 }} />
            </div>
          </FormGroup>
        </Grid>
      </Container>
    );
  }

  // ----- FOOTER -----
  if (tipo === 'footer') {
    const columnas = config.columnas || [];
    const setCol = (idx, field, val) => {
      const n = [...columnas];
      n[idx] = { ...n[idx], [field]: val };
      set('columnas', n);
    };
    const setLink = (colIdx, linkIdx, field, val) => {
      const n = [...columnas];
      const links = [...(n[colIdx].links || [])];
      links[linkIdx] = { ...links[linkIdx], [field]: val };
      n[colIdx] = { ...n[colIdx], links };
      set('columnas', n);
    };
    return (
      <Container>
        <Grid>
          <FormGroup>
            <Label>Logo (upload)</Label>
            <Input type="file" accept="image/*" onChange={e => handleUpload(e.target.files[0], 'logo')} disabled={uploading} />
            {config.logo && <ImgPreview src={config.logo.startsWith('http') ? config.logo : `${BACKEND_BASE}/${config.logo}`} alt="" />}
          </FormGroup>
          <FormGroup>
            <Label>Nombre de marca</Label>
            <Input value={config.nombre_marca || ''} onChange={e => set('nombre_marca', e.target.value)} placeholder="MentorIA" />
          </FormGroup>
          <FormGroup $full>
            <Label>Descripción</Label>
            <TextArea value={config.descripcion || ''} onChange={e => set('descripcion', e.target.value)} placeholder="Plataforma de educación médica..." style={{ minHeight: 50 }} />
          </FormGroup>
          <FormGroup>
            <Label>Color fondo</Label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="color" value={config.color_fondo || '#0f355b'} onChange={e => set('color_fondo', e.target.value)} style={{ width: 36, height: 30 }} />
              <Input value={config.color_fondo || ''} onChange={e => set('color_fondo', e.target.value)} style={{ width: 90 }} />
            </div>
          </FormGroup>
          <FormGroup>
            <Label>Color texto</Label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="color" value={config.color_texto || '#ffffff'} onChange={e => set('color_texto', e.target.value)} style={{ width: 36, height: 30 }} />
              <Input value={config.color_texto || ''} onChange={e => set('color_texto', e.target.value)} style={{ width: 90 }} />
            </div>
          </FormGroup>
          <FormGroup $full>
            <Label>Texto copyright</Label>
            <Input value={config.texto_copyright || ''} onChange={e => set('texto_copyright', e.target.value)} placeholder="© 2026 MentorIA. Todos los derechos reservados." />
          </FormGroup>
          <FormGroup $full>
            <Label>Texto derecha (opcional)</Label>
            <Input value={config.texto_derecha || ''} onChange={e => set('texto_derecha', e.target.value)} placeholder="Powered by IA" />
          </FormGroup>
        </Grid>

        <Label style={{ marginTop: 12 }}>Columnas de enlaces</Label>
        {columnas.map((col, ci) => (
          <div key={ci} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.6rem', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <Input value={col.titulo || ''} onChange={e => setCol(ci, 'titulo', e.target.value)} placeholder="Título columna" style={{ flex: 1 }} />
              <SmallBtn onClick={() => set('columnas', columnas.filter((_, j) => j !== ci))}>×</SmallBtn>
            </div>
            {(col.links || []).map((link, li) => (
              <div key={li} style={{ display: 'flex', gap: 6, marginBottom: 4, marginLeft: 12 }}>
                <Input value={link.texto || ''} onChange={e => setLink(ci, li, 'texto', e.target.value)} placeholder="Texto enlace" style={{ flex: 1 }} />
                <Select value={link.accion || 'url'} onChange={e => setLink(ci, li, 'accion', e.target.value)} style={{ width: 100 }}>
                  <option value="url">URL</option>
                  <option value="login">Login</option>
                  <option value="registro">Registro</option>
                </Select>
                {(link.accion || 'url') === 'url' && (
                  <Input value={link.url || ''} onChange={e => setLink(ci, li, 'url', e.target.value)} placeholder="https://..." style={{ flex: 1 }} />
                )}
                <SmallBtn onClick={() => {
                  const links = (col.links || []).filter((_, j) => j !== li);
                  setCol(ci, 'links', links);
                }}>×</SmallBtn>
              </div>
            ))}
            <AddBtn onClick={() => setCol(ci, 'links', [...(col.links || []), { texto: '', accion: 'url', url: '' }])} style={{ marginLeft: 12, marginTop: 4 }}>
              + Enlace
            </AddBtn>
          </div>
        ))}
        <AddBtn onClick={() => set('columnas', [...columnas, { titulo: '', links: [] }])}>+ Agregar columna</AddBtn>
      </Container>
    );
  }

  // ----- CONTENIDOS CAROUSEL -----
  if (tipo === 'contenidos_carousel') {
    const manualItems = config.items || [];
    const setManualItem = (idx, field, val) => {
      const n = [...manualItems];
      n[idx] = { ...n[idx], [field]: val };
      set('items', n);
    };
    return (
      <Container>
        <Grid>
          <FormGroup $full>
            <Label>Título</Label>
            <Input value={config.titulo || ''} onChange={e => set('titulo', e.target.value)} placeholder="Nuestros Contenidos" />
          </FormGroup>
          <FormGroup $full>
            <Label>Subtítulo</Label>
            <Input value={config.subtitulo || ''} onChange={e => set('subtitulo', e.target.value)} placeholder="Explora nuestro catálogo" />
          </FormGroup>
          <FormGroup>
            <Label>Fuente de datos</Label>
            <Select value={config.fuente || 'auto'} onChange={e => set('fuente', e.target.value)}>
              <option value="auto">Automático (documentos del proyecto)</option>
              <option value="manual">Manual (definir items)</option>
            </Select>
          </FormGroup>
          <FormGroup>
            <Label>Color fondo</Label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="color" value={config.color_fondo || '#0b1929'} onChange={e => set('color_fondo', e.target.value)} style={{ width: 36, height: 30 }} />
              <Input value={config.color_fondo || ''} onChange={e => set('color_fondo', e.target.value)} style={{ width: 90 }} />
            </div>
          </FormGroup>
          <FormGroup>
            <Label>Color tarjeta</Label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="color" value={config.color_tarjeta || '#162337'} onChange={e => set('color_tarjeta', e.target.value)} style={{ width: 36, height: 30 }} />
              <Input value={config.color_tarjeta || ''} onChange={e => set('color_tarjeta', e.target.value)} style={{ width: 90 }} />
            </div>
          </FormGroup>
          <FormGroup>
            <Label>Color título</Label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="color" value={config.color_titulo || '#ffffff'} onChange={e => set('color_titulo', e.target.value)} style={{ width: 36, height: 30 }} />
              <Input value={config.color_titulo || ''} onChange={e => set('color_titulo', e.target.value)} style={{ width: 90 }} />
            </div>
          </FormGroup>
          <FormGroup>
            <Label>Ancho tarjeta (px)</Label>
            <Input value={config.ancho_tarjeta || ''} onChange={e => set('ancho_tarjeta', e.target.value)} placeholder="280" />
          </FormGroup>
          <FormGroup>
            <Label>Altura imagen (px)</Label>
            <Input value={config.altura_imagen || ''} onChange={e => set('altura_imagen', e.target.value)} placeholder="160px" />
          </FormGroup>
          <FormGroup>
            <Label>Gap entre tarjetas (px)</Label>
            <Input value={config.gap || ''} onChange={e => set('gap', e.target.value)} placeholder="16" />
          </FormGroup>
          <FormGroup>
            <Label>Border radius tarjeta</Label>
            <Input value={config.radio_tarjeta || ''} onChange={e => set('radio_tarjeta', e.target.value)} placeholder="12px" />
          </FormGroup>
        </Grid>

        {config.fuente === 'manual' && (
          <>
            <Label style={{ marginTop: 12 }}>Items manuales</Label>
            {manualItems.map((item, i) => (
              <ItemRow key={i}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Input value={item.titulo || ''} onChange={e => setManualItem(i, 'titulo', e.target.value)} placeholder="Título" />
                  <Input value={item.descripcion || ''} onChange={e => setManualItem(i, 'descripcion', e.target.value)} placeholder="Descripción" />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Input type="file" accept="image/*" onChange={e => handleItemUpload(e.target.files[0], 'items', i, 'imagen')} disabled={uploading} style={{ fontSize: '0.8rem' }} />
                    {item.imagen && <ImgPreview src={item.imagen.startsWith('http') ? item.imagen : `${BACKEND_BASE}/${item.imagen}`} alt="" />}
                  </div>
                  <Input value={item.badge || ''} onChange={e => setManualItem(i, 'badge', e.target.value)} placeholder="Badge (opcional)" style={{ width: 150 }} />
                </div>
                <SmallBtn onClick={() => set('items', manualItems.filter((_, j) => j !== i))}>×</SmallBtn>
              </ItemRow>
            ))}
            <AddBtn onClick={() => set('items', [...manualItems, { titulo: '', descripcion: '', imagen: '', badge: '' }])}>+ Agregar item</AddBtn>
          </>
        )}
        {config.fuente !== 'manual' && (
          <div style={{ marginTop: 8, padding: '0.6rem', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#64748b' }}>
            Se mostrarán automáticamente los documentos asignados al proyecto como tarjetas tipo Netflix.
          </div>
        )}
      </Container>
    );
  }

  return <div style={{ color: '#94a3b8' }}>Tipo de sección no reconocido: {tipo}</div>;
};

export default GenericSectionForm;
