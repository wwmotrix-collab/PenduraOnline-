# 📒 Pendura Online v2.1

**Gestão de confiança comercial entre vizinhos.**  
Evolução do MVP para plataforma completa de relacionamento comercial digital.

---

## 🆕 O que há de novo na v2.1

| Feature | Descrição |
|---|---|
| 🤝 Confiança Comercial | Score 0–100% com rótulos humanos, histórico e evolução |
| 💳 Limite de crédito | Total por cliente com barra visual de utilização |
| 📅 Prazo de pagamento | Data prevista em cada compra, calendário de vencimentos |
| 📅 Calendário | Tela visual com dias coloridos por status |
| 🎯 Microinterações | Moedas, checks, estrelas, vibração, barras animadas |
| 🏆 Streaks & Badges | Conquistas leves e humanizadas |
| 📊 Aba Relacionamento | Histórico visual de cada cliente |
| 🌙 Dark mode elegante | Design inspirado em fintech moderna |
| 💰 Pagamento parcial | Barra de progresso de quitação em tempo real |
| 🔗 Deep links WA | Links diretos que abrem a pendura certa |
| ⚙️ Perfil do comércio | Nome, WhatsApp, tipo, endereço — tudo editável |

---

## 🚀 Deploy em 5 passos

### 1. Clonar / baixar
```bash
git clone SEU_REPO
cd pendura-online
```

### 2. Supabase
1. Crie projeto em [supabase.com](https://supabase.com)
2. **SQL Editor** → cole e execute `supabase_schema.sql`
3. **Settings → API** → copie `Project URL` e `anon public key`

### 3. Configurar
Edite `js/config.js`:
```js
const SUPABASE_CONFIG = {
  url:     'https://SEU-PROJETO.supabase.co',
  anonKey: 'SUA-CHAVE-ANON'
};
const DEMO_MODE = false;
```

### 4. Ícones (se necessário)
```bash
pip install cairosvg
python3 generate_icons.py
```
Ou converta os SVGs em [cloudconvert.com](https://cloudconvert.com/svg-to-png).

### 5. Vercel
```bash
npm i -g vercel
vercel --prod
```
Ou arraste a pasta no [dashboard da Vercel](https://vercel.com/new).

---

## 🧪 Modo Demo

Com `DEMO_MODE = true` (padrão), o app roda sem Supabase com dados de exemplo:

- **Maria Silva** — 120 dias de relacionamento, histórico rico, confiança alta
- **José Santos** — cliente com saldo zerado
- **Ana Oliveira** — cliente novo com pendência

**Login demo:** qualquer telefone + qualquer senha

---

## 💬 Integração WhatsApp — todas as mensagens

| Evento | Mensagem |
|---|---|
| Nova compra | Valor + descrição + link de confirmação |
| Pagamento recebido | Recibo + saldo restante |
| Novo cliente | Boas-vindas + link de acesso |
| Pedir confirmação | Lembrete amigável de pendência |
| Enviar saldo | Extrato formatado |
| Lembrete amigável | Mensagem humanizada sem pressão |
| Enviar link | Link de acesso direto |
| Cliente confirma | Notifica comerciante |
| Cliente contesta | Notifica comerciante com motivo |

**Todas as mensagens usam o nome e WhatsApp reais do comércio configurado.**

---

## 📁 Estrutura de arquivos

```
pendura-v21/
├── index.html                    # App completo (8 telas + 8 modais)
├── sw.js                         # Service Worker
├── manifest.json                 # PWA manifest
├── vercel.json                   # Config Vercel
├── supabase_schema.sql           # 10 tabelas + triggers + funções
├── css/
│   └── main.css                  # ~900 linhas — dark design system
├── js/
│   ├── config.js                 # ⚙️ CONFIGURAR AQUI
│   ├── supabase.js               # Camada de dados
│   ├── app.js                    # Orquestrador principal
│   ├── pwa.js                    # PWA install
│   ├── modules/
│   │   ├── fx.js                 # Microinterações e partículas
│   │   ├── confidence.js         # Sistema de confiança comercial
│   │   ├── calendar.js           # Calendário de pagamentos
│   │   └── profile.js            # Perfil do comércio
│   └── services/
│       └── whatsapp.js           # Todas as mensagens WA
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## 🗄️ Banco de dados — 10 tabelas

| Tabela | Finalidade |
|---|---|
| `merchants` | Comerciantes cadastrados |
| `merchant_profiles` | Perfil detalhado do comércio |
| `customers` | Clientes por comerciante |
| `ledgers` | Canal privado (caderneta bilateral) |
| `transactions` | Todos os lançamentos |
| `payment_schedules` | Agendamentos e vencimentos |
| `confidence_history` | Histórico de score de confiança |
| `badges` | Conquistas por relacionamento |
| `streaks` | Sequências de bom comportamento |
| `notifications` | Log de notificações enviadas |

---

## 🎨 Design System

| Token | Valor |
|---|---|
| Background | `#0d1f14` (verde escuro profundo) |
| Surface | `#1e3327` |
| Verde | `#2d9a58` / `#3dbb6c` |
| Dourado | `#c9a84c` / `#e8c56a` |
| Tipografia display | Fraunces (serifada elegante) |
| Tipografia corpo | DM Sans |

---

## 🔮 Próximas features (v3.0)

- [ ] Supabase Auth com OTP por SMS
- [ ] Push notifications (web push)
- [ ] QR Code de acesso
- [ ] PIX integrado (link de cobrança)
- [ ] Relatórios mensais automáticos por WA
- [ ] Backup/exportação CSV
- [ ] Multi-merchant para clientes

---

Feito com ❤️ para o comércio de bairro brasileiro.  
**Confiança entre vizinhos, digital como o tempo pede.**
