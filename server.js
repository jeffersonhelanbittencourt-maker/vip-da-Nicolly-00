const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { MercadoPagoConfig } = require('mercadopago');

const app = express();
app.use(express.json());

// Credenciais fixas direto no código
const SUPABASE_URL = 'https://wodlhlwezckslounvmlx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_gTnYby203YRRUb0DeNqcKg_Nqe0M9Yr';
const MERCADO_PAGO_TOKEN = 'APP_USR-4480456642803254-111801-be3d1e41d0eb72ba4a94bcd81ee19496-16180848';

console.log("Inicializando o servidor...");

// Inicialização segura do Supabase sem ativar subscrições em tempo real
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Inicialização do Mercado Pago
const client = new MercadoPagoConfig({ accessToken: MERCADO_PAGO_TOKEN });

const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    app: 'VIP da Nicolly',
    supabaseConnected: true,
    mercadoPagoConfigured: true
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando perfeitamente na porta ${PORT}`);
});
