-- SQL Idempotente para ChargeFlow
-- Pode ser rodado múltiplas vezes sem erro

-- 1. Criar ENUMs (se não existirem)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_session_status') THEN
        CREATE TYPE whatsapp_session_status AS ENUM ('DISCONNECTED', 'CONNECTING', 'CONNECTED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'charge_status') THEN
        CREATE TYPE charge_status AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_trigger_type') THEN
        CREATE TYPE notification_trigger_type AS ENUM ('BEFORE_2_DAYS', 'ON_DUE_DATE', 'AFTER_3_DAYS');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN
        CREATE TYPE notification_status AS ENUM ('SUCCESS', 'FAILED');
    END IF;
END $$;

-- 2. Tabela profiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT,
    whatsapp_session_status whatsapp_session_status NOT NULL DEFAULT 'DISCONNECTED',
    whatsapp_instance_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela customers
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela charges
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

-- 5. Tabela notification_logs
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    charge_id UUID NOT NULL REFERENCES charges(id) ON DELETE CASCADE,
    trigger_type notification_trigger_type NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status notification_status NOT NULL,
    message_body TEXT NOT NULL
);

-- 6. Índices
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_charges_user_id ON charges(user_id);
CREATE INDEX IF NOT EXISTS idx_charges_customer_id ON charges(customer_id);
CREATE INDEX IF NOT EXISTS idx_charges_status ON charges(status);
CREATE INDEX IF NOT EXISTS idx_charges_due_date ON charges(due_date);
CREATE INDEX IF NOT EXISTS idx_notification_logs_charge_id ON notification_logs(charge_id);

-- 7. RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- 8. Políticas RLS (apaga e recria para garantir)
DO $$
BEGIN
    -- Profiles
    DROP POLICY IF EXISTS "Profiles select own" ON profiles;
    DROP POLICY IF EXISTS "Profiles update own" ON profiles;
    DROP POLICY IF EXISTS "Profiles insert own" ON profiles;
    CREATE POLICY "Profiles select own" ON profiles FOR SELECT USING (auth.uid() = id);
    CREATE POLICY "Profiles update own" ON profiles FOR UPDATE USING (auth.uid() = id);
    CREATE POLICY "Profiles insert own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

    -- Customers
    DROP POLICY IF EXISTS "Customers user access" ON customers;
    CREATE POLICY "Customers user access" ON customers FOR ALL USING (auth.uid() = user_id);

    -- Charges
    DROP POLICY IF EXISTS "Charges user access" ON charges;
    CREATE POLICY "Charges user access" ON charges FOR ALL USING (auth.uid() = user_id);

    -- Notification Logs
    DROP POLICY IF EXISTS "Logs user access" ON notification_logs;
    CREATE POLICY "Logs user access" ON notification_logs FOR SELECT USING (
        EXISTS (SELECT 1 FROM charges WHERE charges.id = notification_logs.charge_id AND charges.user_id = auth.uid())
    );
END $$;

-- 9. Trigger para criar perfil automaticamente no cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, company_name, whatsapp_session_status)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'company_name', 'DISCONNECTED');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
