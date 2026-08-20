-- Adiciona coluna whatsapp_instance_token na tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_instance_token TEXT;
