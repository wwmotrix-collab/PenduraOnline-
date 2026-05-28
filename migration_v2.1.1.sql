-- ══════════════════════════════════════════════════
-- PENDURA v2.1.1 — MIGRATION INCREMENTAL
-- Execute no SQL Editor do Supabase
-- NÃO apaga dados existentes
-- ══════════════════════════════════════════════════

-- 1. Adiciona coluna de anexo nas transações
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- 2. Índice para busca de clientes por telefone normalizado
-- (otimiza o loginCustomer e dbFindCustomerByPhone)
CREATE INDEX IF NOT EXISTS idx_customers_phone_norm
  ON customers(phone);

-- ══════════════════════════════════════════════════
-- SUPABASE STORAGE — CRIAR BUCKET MANUALMENTE
-- ══════════════════════════════════════════════════
-- O bucket NÃO pode ser criado via SQL puro.
-- Siga os passos abaixo no dashboard do Supabase:
--
-- 1. Acesse seu projeto em https://supabase.com
-- 2. Menu lateral → Storage
-- 3. Clique em "New bucket"
-- 4. Nome: transaction-attachments
-- 5. Public bucket: SIM (para URLs públicas de preview)
--    (ou deixe privado e use signed URLs — mais seguro)
-- 6. Clique em "Create bucket"
--
-- Política de acesso (cole no SQL Editor após criar o bucket):

-- Permite upload autenticado e leitura pública
-- (ajuste conforme seu nível de segurança desejado)

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('transaction-attachments', 'transaction-attachments', true)
-- ON CONFLICT (id) DO NOTHING;

-- Política de leitura pública
CREATE POLICY IF NOT EXISTS "public_read_attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'transaction-attachments');

-- Política de upload (anon para MVP — restrinja com auth em produção)
CREATE POLICY IF NOT EXISTS "anon_upload_attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'transaction-attachments');

-- ══════════════════════════════════════════════════
-- VERIFICAÇÃO
-- Execute para confirmar que a coluna foi criada:
-- ══════════════════════════════════════════════════
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'transactions'
--   AND column_name = 'attachment_url';
