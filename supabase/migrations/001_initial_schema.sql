-- ============================================================
-- ChargeFlow - SaaS de Automação de Cobranças via WhatsApp
-- Script SQL para Supabase (PostgreSQL)
-- ============================================================

-- 1. Criar ENUMs
CREATE TYPE whatsapp_session_status AS ENUM ('DISCONNECTED', 'CONNECTING', 'CONNECTED');
CREATE TYPE charge_status AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');
CREATE TYPE notification_trigger_type AS ENUM ('BEFORE_2_DAYS', 'ON_DUE_DATE', 'AFTER_3_DAYS');
CREATE TYPE notification_status AS ENUM ('SUCCESS', 'FAILED');

-- 2. Tabela profiles (Usuários do SaaS / Donos do Negócio)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT,
    whatsapp_session_status whatsapp_session_status NOT NULL DEFAULT 'DISCONNECTED',
    whatsapp_instance_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela customers (Clientes finais do usuário)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela charges (Cobranças cadastradas)
CREATE TABLE IF NOT EXISTS charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    due_date DATE NOT NULL,
    status charge_status NOT NULL DEFAULT 'PENDING',
    is_recurrent BOOLEAN NOT NULL DEFAULT FALSE,
    recurrent_day INTEGER CHECK (recurrent_day >= 1 AND recurrent_day <= 31),
    payment_link_or_pix TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabela notification_logs (Histórico de envios de WhatsApp)
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    charge_id UUID NOT NULL REFERENCES charges(id) ON DELETE CASCADE,
    trigger_type notification_trigger_type NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status notification_status NOT NULL,
    message_body TEXT NOT NULL
);

-- ============================================================
-- Índices para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_charges_user_id ON charges(user_id);
CREATE INDEX IF NOT EXISTS idx_charges_customer_id ON charges(customer_id);
CREATE INDEX IF NOT EXISTS idx_charges_status ON charges(status);
CREATE INDEX IF NOT EXISTS idx_charges_due_date ON charges(due_date);
CREATE INDEX IF NOT EXISTS idx_notification_logs_charge_id ON notification_logs(charge_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_trigger ON notification_logs(charge_id, trigger_type);

-- ============================================================
-- Row Level Security (RLS) - Habilitar em todas as tabelas
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Políticas RLS - profiles
-- ============================================================
CREATE POLICY "Profiles: usuários podem ver apenas seu próprio perfil"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Profiles: usuários podem editar apenas seu próprio perfil"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Profiles: permitir insert pelo trigger de auth"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================================
-- Políticas RLS - customers
-- ============================================================
CREATE POLICY "Customers: usuários podem ver apenas seus clientes"
    ON customers FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Customers: usuários podem criar apenas seus clientes"
    ON customers FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Customers: usuários podem atualizar apenas seus clientes"
    ON customers FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Customers: usuários podem deletar apenas seus clientes"
    ON customers FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================
-- Políticas RLS - charges
-- ============================================================
CREATE POLICY "Charges: usuários podem ver apenas suas cobranças"
    ON charges FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Charges: usuários podem criar apenas suas cobranças"
    ON charges FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Charges: usuários podem atualizar apenas suas cobranças"
    ON charges FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Charges: usuários podem deletar apenas suas cobranças"
    ON charges FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================
-- Políticas RLS - notification_logs
-- ============================================================
CREATE POLICY "NotificationLogs: usuários podem ver apenas logs de suas cobranças"
    ON notification_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM charges
            WHERE charges.id = notification_logs.charge_id
            AND charges.user_id = auth.uid()
        )
    );

-- ============================================================
-- Trigger: Criar perfil automaticamente ao registrar usuário
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, company_name, whatsapp_session_status)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'company_name', 'DISCONNECTED');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Trigger: Atualizar updated_at (opcional)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
