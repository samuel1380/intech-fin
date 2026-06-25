-- ============================================================
-- FinNexus Enterprise - SQL para Supabase
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- Tabela de preferências de notificação por usuário
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text UNIQUE NOT NULL,
  preferences jsonb NOT NULL DEFAULT '{}',
  push_subscription jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: qualquer pessoa autenticada pode ler/escrever suas próprias prefs
-- (Como o sistema usa usuário único, permite tudo via anon key)
CREATE POLICY "Allow all for notification_preferences"
  ON notification_preferences
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tabela de configurações gerais do sistema (como o Keep-Alive)
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Policy de acesso para system_settings (leitura/escrita geral via anon key)
CREATE POLICY "Allow all for system_settings"
  ON system_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Verificar se as tabelas foram criadas corretamente
-- ============================================================
SELECT 
  table_name,
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('notification_preferences', 'system_settings')
ORDER BY table_name, ordinal_position;
