-- ══════════════════════════════════════════════════
-- PENDURA ONLINE v2.1 — SCHEMA SUPABASE COMPLETO
-- Execute no SQL Editor do seu projeto Supabase
-- ══════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── MERCHANTS ────────────────────────────────────
CREATE TABLE merchants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── MERCHANT PROFILES ────────────────────────────
CREATE TABLE merchant_profiles (
  id             UUID PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
  business_name  TEXT NOT NULL DEFAULT '',
  owner_name     TEXT NOT NULL DEFAULT '',
  phone          TEXT NOT NULL DEFAULT '',
  whatsapp       TEXT NOT NULL DEFAULT '',
  address        TEXT NOT NULL DEFAULT '',
  business_type  TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── CUSTOMERS ────────────────────────────────────
CREATE TABLE customers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id   UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL,
  limit_total   NUMERIC(10,2),          -- limite total de crédito
  limit_visible BOOLEAN DEFAULT TRUE,   -- mostrar limite ao cliente?
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(merchant_id, phone)
);

-- ── LEDGERS ──────────────────────────────────────
CREATE TABLE ledgers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  balance     NUMERIC(10,2) DEFAULT 0.00,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(merchant_id, customer_id)
);

-- ── TRANSACTIONS ─────────────────────────────────
CREATE TABLE transactions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ledger_id    UUID NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('purchase','payment')),
  amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  description  TEXT DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','confirmed','contested','cancelled')),
  created_by   TEXT NOT NULL CHECK (created_by IN ('merchant','customer')),
  confirmed_by TEXT CHECK (confirmed_by IN ('merchant','customer')),
  due_date     DATE,                    -- prazo de pagamento (v2.1)
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── PAYMENT SCHEDULES ────────────────────────────
-- Agendamentos / vencimentos planejados
CREATE TABLE payment_schedules (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ledger_id   UUID NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL,
  description TEXT DEFAULT '',
  due_date    DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','paid','cancelled')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── CONFIDENCE HISTORY ───────────────────────────
-- Snapshot do score de confiança (calculado periodicamente)
CREATE TABLE confidence_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ledger_id   UUID NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
  score       SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
  badge_label TEXT NOT NULL DEFAULT '',
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── BADGES ───────────────────────────────────────
CREATE TABLE badges (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ledger_id   UUID NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
  badge_id    TEXT NOT NULL,
  badge_label TEXT NOT NULL,
  badge_icon  TEXT NOT NULL DEFAULT '🏅',
  earned_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ledger_id, badge_id)
);

-- ── STREAKS ──────────────────────────────────────
CREATE TABLE streaks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ledger_id   UUID NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
  streak_type TEXT NOT NULL,
  streak_text TEXT NOT NULL,
  streak_icon TEXT NOT NULL DEFAULT '🔥',
  count       SMALLINT DEFAULT 1,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ledger_id, streak_type)
);

-- ── NOTIFICATIONS ────────────────────────────────
-- Log de notificações enviadas (WA, etc.)
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ledger_id   UUID REFERENCES ledgers(id) ON DELETE SET NULL,
  type        TEXT NOT NULL,   -- 'purchase', 'payment', 'reminder', 'balance'
  channel     TEXT DEFAULT 'whatsapp',
  sent_to     TEXT NOT NULL,   -- número de destino
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── ÍNDICES ───────────────────────────────────────
CREATE INDEX idx_customers_merchant    ON customers(merchant_id);
CREATE INDEX idx_customers_phone       ON customers(phone);
CREATE INDEX idx_ledgers_merchant      ON ledgers(merchant_id);
CREATE INDEX idx_ledgers_customer      ON ledgers(customer_id);
CREATE INDEX idx_transactions_ledger   ON transactions(ledger_id);
CREATE INDEX idx_transactions_status   ON transactions(status);
CREATE INDEX idx_transactions_created  ON transactions(created_at DESC);
CREATE INDEX idx_transactions_due      ON transactions(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_schedules_merchant    ON payment_schedules(merchant_id);
CREATE INDEX idx_schedules_due         ON payment_schedules(due_date);
CREATE INDEX idx_conf_history_ledger   ON confidence_history(ledger_id);
CREATE INDEX idx_badges_ledger         ON badges(ledger_id);

-- ── ROW LEVEL SECURITY ────────────────────────────
ALTER TABLE merchants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledgers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_schedules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE confidence_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges              ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;

-- Políticas abertas para MVP (ajuste para produção com Auth)
CREATE POLICY "all_merchants"          ON merchants          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all_merchant_profiles"  ON merchant_profiles  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all_customers"          ON customers          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all_ledgers"            ON ledgers            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all_transactions"       ON transactions       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all_schedules"          ON payment_schedules  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all_confidence_history" ON confidence_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all_badges"             ON badges             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all_streaks"            ON streaks            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all_notifications"      ON notifications      FOR ALL USING (true) WITH CHECK (true);

-- ── TRIGGERS ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_ledger_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_updated
  BEFORE UPDATE ON ledgers
  FOR EACH ROW EXECUTE FUNCTION update_ledger_timestamp();

CREATE OR REPLACE FUNCTION update_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profile_updated
  BEFORE UPDATE ON merchant_profiles
  FOR EACH ROW EXECUTE FUNCTION update_profile_timestamp();

-- ── FUNÇÃO: recalcular saldo ─────────────────────
-- Pode ser chamada por trigger ou manualmente
CREATE OR REPLACE FUNCTION recalc_ledger_balance(p_ledger_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_balance NUMERIC := 0;
BEGIN
  SELECT COALESCE(
    SUM(CASE WHEN type='purchase' THEN amount ELSE -amount END), 0
  )
  INTO v_balance
  FROM transactions
  WHERE ledger_id = p_ledger_id AND status = 'confirmed';

  UPDATE ledgers SET balance = ROUND(v_balance, 2), updated_at = NOW()
  WHERE id = p_ledger_id;

  RETURN ROUND(v_balance, 2);
END;
$$ LANGUAGE plpgsql;

-- Trigger automático de recálculo ao confirmar transação
CREATE OR REPLACE FUNCTION trigger_recalc_on_confirm()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    PERFORM recalc_ledger_balance(NEW.ledger_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tx_status_changed
  AFTER UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION trigger_recalc_on_confirm();

-- ══════════════════════════════════════════════════
-- GUIA DE DEPLOY
-- ══════════════════════════════════════════════════
--
-- 1. Execute este SQL no Supabase SQL Editor
-- 2. Vá em js/config.js e preencha:
--    SUPABASE_CONFIG.url     = 'https://xxxx.supabase.co'
--    SUPABASE_CONFIG.anonKey = 'sua-chave-anon'
--    DEMO_MODE = false
-- 3. Faça deploy na Vercel:
--    vercel --prod
--    (ou importe o repo no dashboard da Vercel)
--
-- Para produção, configure Auth do Supabase
-- e ajuste as políticas RLS acima para usar
-- auth.uid() em vez de USING (true).
