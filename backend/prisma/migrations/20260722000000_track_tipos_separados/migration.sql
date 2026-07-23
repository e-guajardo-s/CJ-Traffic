-- Crear valores nuevos en el enum TipoTrack
ALTER TYPE "TipoTrack" ADD VALUE 'ENLACES' BEFORE 'HITOS_UOCT';
ALTER TYPE "TipoTrack" ADD VALUE 'EMPALMES' BEFORE 'HITOS_UOCT';
ALTER TYPE "TipoTrack" ADD VALUE 'SINTONIA_FINA' BEFORE 'TRASPASOS_MANTENCION';

-- Migrar datos existentes (si los hay): dividir ENLACES_EMPALMES en ENLACES
-- Los registros con ENLACES_EMPALMES se convertirán a ENLACES
UPDATE "ObraTrack" SET "tipo" = 'ENLACES' WHERE "tipo" = 'ENLACES_EMPALMES';

-- Migrar datos existentes: SINTONIA_FINA_EIV a SINTONIA_FINA
UPDATE "ObraTrack" SET "tipo" = 'SINTONIA_FINA' WHERE "tipo" = 'SINTONIA_FINA_EIV';
