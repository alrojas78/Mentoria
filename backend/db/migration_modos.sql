-- Migración: Modos habilitables por documento
-- Agrega columnas booleanas para habilitar/deshabilitar modos por documento
-- Default 1 (habilitado) para retrocompatibilidad

ALTER TABLE documentos
  ADD COLUMN modo_consulta TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN modo_mentor TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN modo_evaluacion TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN modo_reto TINYINT(1) NOT NULL DEFAULT 1;
