// HeroForm.js — Formulario completo para sección Hero
import React, { useState } from 'react';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import { proyectoService, BACKEND_BASE } from '../../../services/api';

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  @media (max-width: 600px) { grid-template-columns: 1fr; }
`;

const Grid3 = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
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
  padding: 0.45rem 0.7rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.85rem;
  &:focus { outline: none; border-color: #14b6cb; }
`;

const TextArea = styled.textarea`
  padding: 0.5rem 0.7rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.85rem;
  resize: vertical;
  min-height: 60px;
  &:focus { outline: none; border-color: #14b6cb; }
`;

const Select = styled.select`
  padding: 0.45rem 0.7rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.85rem;
  &:focus { outline: none; border-color: #14b6cb; }
`;

const ColorRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;
`;

const ColorInput = styled.input`
  width: 36px;
  height: 30px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  padding: 2px;
`;

const ImgPreview = styled.img`
  height: 50px;
  object-fit: contain;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 3px;
  margin-top: 3px;
`;

const CheckLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  cursor: pointer;
`;

const SectionTitle = styled.div`
  grid-column: 1 / -1;
  font-weight: 700;
  font-size: 0.85rem;
  color: #0f355b;
  margin-top: 0.5rem;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid #e2e8f0;
`;

const FONT_OPTIONS = [
  { value: '', label: 'Default (hereda global)' },
  { value: "'Myriad Pro', sans-serif", label: 'Myriad Pro' },
  { value: "'Roboto', sans-serif", label: 'Roboto' },
  { value: "'Open Sans', sans-serif", label: 'Open Sans' },
  { value: "'Montserrat', sans-serif", label: 'Montserrat' },
  { value: "'Poppins', sans-serif", label: 'Poppins' },
  { value: "'Lato', sans-serif", label: 'Lato' },
  { value: "'Inter', sans-serif", label: 'Inter' },
  { value: "'Playfair Display', serif", label: 'Playfair Display' },
  { value: "Georgia, serif", label: 'Georgia' },
];

const HeroForm = ({ config, onChange, proyectoId, seccionId }) => {
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

  return (
    <>
      {/* Textos */}
      <Grid>
        <SectionTitle>Textos</SectionTitle>
        <FormGroup $full>
          <Label>Título</Label>
          <Input value={config.titulo || ''} onChange={e => set('titulo', e.target.value)} placeholder="Título principal" />
        </FormGroup>
        <FormGroup $full>
          <Label>Subtítulo</Label>
          <TextArea value={config.subtitulo || ''} onChange={e => set('subtitulo', e.target.value)} placeholder="Texto descriptivo" />
        </FormGroup>
      </Grid>

      {/* Tipografía título */}
      <Grid>
        <SectionTitle>Tipografía del Título</SectionTitle>
        <FormGroup>
          <Label>Fuente</Label>
          <Select value={config.fuente_titulo || ''} onChange={e => set('fuente_titulo', e.target.value)}>
            {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </Select>
        </FormGroup>
        <FormGroup>
          <Label>Tamaño (px)</Label>
          <Input value={config.tamano_titulo || ''} onChange={e => set('tamano_titulo', e.target.value)} placeholder="52px" />
        </FormGroup>
        <FormGroup>
          <Label>Peso</Label>
          <Select value={config.peso_titulo || '700'} onChange={e => set('peso_titulo', e.target.value)}>
            <option value="300">Light (300)</option>
            <option value="400">Normal (400)</option>
            <option value="600">Semi-Bold (600)</option>
            <option value="700">Bold (700)</option>
            <option value="900">Black (900)</option>
          </Select>
        </FormGroup>
        <FormGroup>
          <Label>Interlineado</Label>
          <Input value={config.interlineado_titulo || ''} onChange={e => set('interlineado_titulo', e.target.value)} placeholder="1.15" />
        </FormGroup>
        <FormGroup>
          <Label>Transformación</Label>
          <Select value={config.transform_titulo || 'none'} onChange={e => set('transform_titulo', e.target.value)}>
            <option value="none">Normal</option>
            <option value="uppercase">MAYÚSCULAS</option>
            <option value="capitalize">Capitalizar</option>
            <option value="lowercase">minúsculas</option>
          </Select>
        </FormGroup>
        <FormGroup>
          <Label>Color título</Label>
          <ColorRow>
            <ColorInput type="color" value={config.color_titulo || '#ffffff'} onChange={e => set('color_titulo', e.target.value)} />
            <Input value={config.color_titulo || ''} onChange={e => set('color_titulo', e.target.value)} style={{ width: 90 }} placeholder="#ffffff" />
          </ColorRow>
        </FormGroup>
      </Grid>

      {/* Tipografía subtítulo */}
      <Grid>
        <SectionTitle>Tipografía del Subtítulo</SectionTitle>
        <FormGroup>
          <Label>Fuente</Label>
          <Select value={config.fuente_subtitulo || ''} onChange={e => set('fuente_subtitulo', e.target.value)}>
            {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </Select>
        </FormGroup>
        <FormGroup>
          <Label>Tamaño (px)</Label>
          <Input value={config.tamano_subtitulo || ''} onChange={e => set('tamano_subtitulo', e.target.value)} placeholder="19px" />
        </FormGroup>
        <FormGroup>
          <Label>Peso</Label>
          <Select value={config.peso_subtitulo || '300'} onChange={e => set('peso_subtitulo', e.target.value)}>
            <option value="300">Light (300)</option>
            <option value="400">Normal (400)</option>
            <option value="600">Semi-Bold (600)</option>
            <option value="700">Bold (700)</option>
          </Select>
        </FormGroup>
        <FormGroup>
          <Label>Interlineado</Label>
          <Input value={config.interlineado_subtitulo || ''} onChange={e => set('interlineado_subtitulo', e.target.value)} placeholder="1.6" />
        </FormGroup>
        <FormGroup>
          <Label>Color subtítulo</Label>
          <ColorRow>
            <ColorInput type="color" value={config.color_subtitulo || '#ffffff'} onChange={e => set('color_subtitulo', e.target.value)} />
            <Input value={config.color_subtitulo || ''} onChange={e => set('color_subtitulo', e.target.value)} style={{ width: 90 }} placeholder="#ffffff" />
          </ColorRow>
        </FormGroup>
      </Grid>

      {/* Layout y dimensiones */}
      <Grid>
        <SectionTitle>Layout y Dimensiones</SectionTitle>
        <FormGroup>
          <Label>Alineación de texto</Label>
          <Select value={config.alineacion_texto || 'center'} onChange={e => set('alineacion_texto', e.target.value)}>
            <option value="left">Izquierda</option>
            <option value="center">Centro</option>
            <option value="right">Derecha</option>
          </Select>
        </FormGroup>
        <FormGroup>
          <Label>Disposición</Label>
          <Select value={config.layout || ''} onChange={e => set('layout', e.target.value)}>
            <option value="">Auto (imagen izq si existe)</option>
            <option value="img-left">Imagen izquierda</option>
            <option value="img-right">Imagen derecha</option>
            <option value="text-only">Solo texto (sin imagen)</option>
          </Select>
        </FormGroup>
        <FormGroup>
          <Label>Alineación vertical</Label>
          <Select value={config.alineacion_vertical || 'center'} onChange={e => set('alineacion_vertical', e.target.value)}>
            <option value="flex-start">Arriba</option>
            <option value="center">Centro</option>
            <option value="flex-end">Abajo</option>
          </Select>
        </FormGroup>
        <FormGroup>
          <Label>Altura mínima</Label>
          <Input value={config.altura_minima || ''} onChange={e => set('altura_minima', e.target.value)} placeholder="500px, 80vh, auto" />
        </FormGroup>
        <FormGroup>
          <Label>Padding general</Label>
          <Input value={config.padding || ''} onChange={e => set('padding', e.target.value)} placeholder="2rem, 4rem 2rem" />
        </FormGroup>
        <FormGroup>
          <Label>Padding contenido</Label>
          <Input value={config.padding_contenido || ''} onChange={e => set('padding_contenido', e.target.value)} placeholder="2rem" />
        </FormGroup>
        <FormGroup>
          <Label>Ancho máximo</Label>
          <Input value={config.ancho_maximo || ''} onChange={e => set('ancho_maximo', e.target.value)} placeholder="1200px" />
        </FormGroup>
        <FormGroup>
          <Label>Ancho imagen (%)</Label>
          <Input value={config.ancho_imagen || ''} onChange={e => set('ancho_imagen', e.target.value)} placeholder="50%" />
        </FormGroup>
        <FormGroup>
          <Label>Ancho contenido (%)</Label>
          <Input value={config.ancho_contenido || ''} onChange={e => set('ancho_contenido', e.target.value)} placeholder="50%" />
        </FormGroup>
        <FormGroup>
          <Label>Altura máx imagen</Label>
          <Input value={config.altura_imagen || ''} onChange={e => set('altura_imagen', e.target.value)} placeholder="450px" />
        </FormGroup>
      </Grid>

      {/* Imágenes y fondos */}
      <Grid>
        <SectionTitle>Imágenes y Fondos</SectionTitle>
        <FormGroup>
          <Label>Imagen de fondo</Label>
          <Input type="file" accept="image/*" onChange={e => handleUpload(e.target.files[0], 'imagen_fondo')} disabled={uploading} />
          {config.imagen_fondo && <ImgPreview src={config.imagen_fondo.startsWith('http') ? config.imagen_fondo : `${BACKEND_BASE}/${config.imagen_fondo}`} alt="" />}
        </FormGroup>
        <FormGroup>
          <Label>Imagen principal</Label>
          <Input type="file" accept="image/*" onChange={e => handleUpload(e.target.files[0], 'imagen_principal')} disabled={uploading} />
          {config.imagen_principal && <ImgPreview src={config.imagen_principal.startsWith('http') ? config.imagen_principal : `${BACKEND_BASE}/${config.imagen_principal}`} alt="" />}
        </FormGroup>
        <FormGroup>
          <Label>Posición fondo</Label>
          <Select value={config.posicion_fondo || 'center'} onChange={e => set('posicion_fondo', e.target.value)}>
            <option value="center">Centro</option>
            <option value="top">Arriba</option>
            <option value="bottom">Abajo</option>
            <option value="left">Izquierda</option>
            <option value="right">Derecha</option>
          </Select>
        </FormGroup>
        <FormGroup>
          <Label>Overlay fondo (ej: rgba(0,0,0,0.4))</Label>
          <Input value={config.overlay_fondo || ''} onChange={e => set('overlay_fondo', e.target.value)} placeholder="rgba(0,0,0,0.4)" />
        </FormGroup>
      </Grid>

      {/* Colores generales */}
      <Grid3>
        <SectionTitle>Colores</SectionTitle>
        <FormGroup>
          <Label>Color primario</Label>
          <ColorRow>
            <ColorInput type="color" value={config.color_primario || '#0f355b'} onChange={e => set('color_primario', e.target.value)} />
            <Input value={config.color_primario || ''} onChange={e => set('color_primario', e.target.value)} style={{ width: 90 }} />
          </ColorRow>
        </FormGroup>
        <FormGroup>
          <Label>Color secundario</Label>
          <ColorRow>
            <ColorInput type="color" value={config.color_secundario || '#14b6cb'} onChange={e => set('color_secundario', e.target.value)} />
            <Input value={config.color_secundario || ''} onChange={e => set('color_secundario', e.target.value)} style={{ width: 90 }} />
          </ColorRow>
        </FormGroup>
      </Grid3>

      {/* Botones */}
      <Grid>
        <SectionTitle>Botones</SectionTitle>
        <FormGroup>
          <Label>Texto botón login</Label>
          <Input value={config.texto_boton_login || ''} onChange={e => set('texto_boton_login', e.target.value)} placeholder="Inicia sesión" />
          <CheckLabel>
            <input type="checkbox" checked={config.boton_login !== false} onChange={e => set('boton_login', e.target.checked)} />
            Mostrar
          </CheckLabel>
        </FormGroup>
        <FormGroup>
          <Label>Texto botón registro</Label>
          <Input value={config.texto_boton_registro || ''} onChange={e => set('texto_boton_registro', e.target.value)} placeholder="Regístrate" />
          <CheckLabel>
            <input type="checkbox" checked={config.boton_registro !== false} onChange={e => set('boton_registro', e.target.checked)} />
            Mostrar
          </CheckLabel>
        </FormGroup>
        <FormGroup>
          <Label>Color botón login</Label>
          <ColorRow>
            <ColorInput type="color" value={config.color_boton_login || '#14b6cb'} onChange={e => set('color_boton_login', e.target.value)} />
            <Input value={config.color_boton_login || ''} onChange={e => set('color_boton_login', e.target.value)} style={{ width: 90 }} />
          </ColorRow>
        </FormGroup>
        <FormGroup>
          <Label>Color botón registro</Label>
          <ColorRow>
            <ColorInput type="color" value={config.color_boton_registro || '#14b6cb'} onChange={e => set('color_boton_registro', e.target.value)} />
            <Input value={config.color_boton_registro || ''} onChange={e => set('color_boton_registro', e.target.value)} style={{ width: 90 }} />
          </ColorRow>
        </FormGroup>
        <FormGroup>
          <Label>Padding botones</Label>
          <Input value={config.padding_botones || ''} onChange={e => set('padding_botones', e.target.value)} placeholder="10px 32px" />
        </FormGroup>
        <FormGroup>
          <Label>Border radius botones</Label>
          <Input value={config.radio_botones || ''} onChange={e => set('radio_botones', e.target.value)} placeholder="8px, 30px" />
        </FormGroup>
        <FormGroup>
          <Label>Tamaño fuente botones</Label>
          <Input value={config.tamano_botones || ''} onChange={e => set('tamano_botones', e.target.value)} placeholder="17px" />
        </FormGroup>
        <FormGroup>
          <Label>Borde botones</Label>
          <Input value={config.borde_botones || ''} onChange={e => set('borde_botones', e.target.value)} placeholder="2px solid #fff" />
        </FormGroup>
      </Grid>
    </>
  );
};

export default HeroForm;
