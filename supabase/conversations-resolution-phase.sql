-- =============================================================================
-- Innover Suite — CRM: Resolución de Conversaciones e Historial Unificado
-- Permite culminar conversaciones con éxito, archivarlas y consultarlas
-- por cliente y cronológicamente por fecha.
-- =============================================================================

-- 1. Asegurar campos opcionales dedicados para auditoría de resolución en conversations
-- Nota: La aplicación almacena la metadata completa en `conversations.metadata` (JSONB)
-- incluyendo `resolution_history` (arreglo histórico con cada ciclo de resolución).
-- Estas columnas permiten consultas SQL directas y filtros indexados adicionales.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'resolved_at'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN resolved_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'resolved_by'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'resolution_outcome'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN resolution_outcome varchar(50) DEFAULT 'successful';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'resolution_reason'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN resolution_reason varchar(120);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'resolution_summary'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN resolution_summary text;
  END IF;
END $$;

-- 2. Índices de alto rendimiento para filtrado rápido por fecha, estado y cliente
CREATE INDEX IF NOT EXISTS idx_conversations_org_contact_date 
  ON public.conversations(organization_id, contact_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_org_status_date 
  ON public.conversations(organization_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_resolved_at 
  ON public.conversations(organization_id, resolved_at DESC) 
  WHERE status = 'resolved';
