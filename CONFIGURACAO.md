# PENDURA v2.1.3 — CONFIGURAÇÃO RÁPIDA

## Passo 1 — Supabase

1. Acesse https://supabase.com e crie (ou abra) seu projeto
2. Vá em **SQL Editor** e execute o arquivo `supabase_schema.sql`
3. Execute também o `migration_v2.1.1.sql` se já tinha o schema anterior
4. Vá em **Settings → API** e copie:
   - **Project URL** (ex: `https://xyzabc.supabase.co`)
   - **anon public key** (começa com `eyJ...`)

## Passo 2 — Bucket de fotos no Supabase Storage

1. Menu lateral do Supabase → **Storage**
2. Clique em **New bucket**
3. Nome: `transaction-attachments`
4. **Public bucket: SIM** (para URLs de preview funcionarem)
5. Clique em **Create bucket**

## Passo 3 — Configurar o app

Abra o arquivo `js/config.js` e edite as 3 linhas:

```js
const SUPABASE_CONFIG = {
  url:     'https://SEU-PROJETO.supabase.co',  // ← sua URL real
  anonKey: 'eyJ...'                             // ← sua chave anon real
};

const DEMO_MODE = false;  // ← mude para false em produção
```

> **Atenção:** com `DEMO_MODE = true` o app usa dados de exemplo locais.
> Nenhum dado é salvo no banco. Use `false` para produção.

## Passo 4 — Deploy na Vercel

```bash
# Opção A — CLI
npm i -g vercel
vercel --prod

# Opção B — Dashboard
# Acesse vercel.com → New Project → importe o repositório → Deploy
```

---

## Telefones de teste (DEMO_MODE = true)

| Cliente       | Telefone      |
|---------------|---------------|
| Maria Silva   | 51999990010   |
| José Santos   | 51999990011   |
| Ana Oliveira  | 51999990012   |

**Login comerciante demo:** qualquer telefone + qualquer senha (mínimo 4 caracteres)

---

## Checklist de produção

- [ ] `DEMO_MODE = false` em `js/config.js`
- [ ] URL do Supabase preenchida
- [ ] Anon key preenchida
- [ ] Schema SQL executado
- [ ] Migration SQL executado (se atualização)
- [ ] Bucket `transaction-attachments` criado e público
- [ ] Deploy feito na Vercel
