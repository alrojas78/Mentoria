// StatsForm.js — Formulario de edición para sección Stats
import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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
  align-items: center;
  padding: 0.5rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
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

const Row = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const StatsForm = ({ config, onChange }) => {
  const items = config.items || [];

  const set = (key, val) => onChange({ ...config, [key]: val });

  const setItem = (idx, field, val) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: val };
    set('items', newItems);
  };

  const addItem = () => set('items', [...items, { valor: '', etiqueta: '' }]);

  const removeItem = (idx) => set('items', items.filter((_, i) => i !== idx));

  return (
    <Container>
      <Row>
        <div>
          <Label>Color de fondo</Label>
          <ColorRow>
            <ColorInput type="color" value={config.color_fondo || '#0f355b'} onChange={e => set('color_fondo', e.target.value)} />
            <Input value={config.color_fondo || ''} onChange={e => set('color_fondo', e.target.value)} style={{ width: 100 }} placeholder="#0f355b" />
          </ColorRow>
        </div>
        <div>
          <Label>Color de texto</Label>
          <ColorRow>
            <ColorInput type="color" value={config.color_texto || '#ffffff'} onChange={e => set('color_texto', e.target.value)} />
            <Input value={config.color_texto || ''} onChange={e => set('color_texto', e.target.value)} style={{ width: 100 }} placeholder="#ffffff" />
          </ColorRow>
        </div>
      </Row>

      <Label>Items de estadísticas</Label>
      {items.map((item, idx) => (
        <ItemRow key={idx}>
          <Input
            value={item.valor || ''}
            onChange={e => setItem(idx, 'valor', e.target.value)}
            placeholder="98%"
            style={{ width: 100 }}
          />
          <Input
            value={item.etiqueta || ''}
            onChange={e => setItem(idx, 'etiqueta', e.target.value)}
            placeholder="Precisión en respuestas"
            style={{ flex: 1 }}
          />
          <SmallBtn onClick={() => removeItem(idx)} title="Eliminar">×</SmallBtn>
        </ItemRow>
      ))}
      <AddBtn onClick={addItem}>+ Agregar estadística</AddBtn>
    </Container>
  );
};

export default StatsForm;
