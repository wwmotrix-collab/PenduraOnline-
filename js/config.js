const SUPABASE_CONFIG = {
  url: 'https://pugnwoecrcjavbteyjcq.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1Z253b2VjcmNqYXZidGV5amNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjE5MzYsImV4cCI6MjA5NTI5NzkzNn0.bcxwiOC04oggOwwPTPx5Pgn9lGTzjnYG-wrDUuY2c7U'
};

const DEMO_MODE = false;

const STORAGE_CONFIG = {
  transactionBucket: 'transaction-attachments'
};

const APP_CONFIG = {
  version: '2.1.3',
  appName: 'Pendura Online',
  production: true,
  allowDemoSeed: false,
  maxImageSizeMB: 5,
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp']
};

const DB = {
  merchant: null,
  customers: [],
  ledgers: [],
  transactions: [],
  schedules: [],
  _id: 200
};

function seedDemo() {
  console.warn('[Pendura] seedDemo bloqueado em produção.');
}

const PENDURA_ENV = {
  mode: DEMO_MODE ? 'DEMO' : 'PRODUCTION',
  supabaseUrl: SUPABASE_CONFIG.url,
  bucket: STORAGE_CONFIG.transactionBucket,
  version: APP_CONFIG.version
};

console.log('[Pendura] Config carregado:', PENDURA_ENV);
