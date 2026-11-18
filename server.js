const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();
app.use(express.json());

// Credenciais fixadas diretamente no código para evitar erros de leitura no Render
const SUPABASE_URL = 'https://wodlhlwezckslounvmlx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_gTnYby203YRRUb0DeNqcKg_Nqe0M9Yr';
const SUPABASE_SECRET_KEY = 'sb_secret_0E9RMEYOFX9o7KY398qXIA_TAbzUpne';
const MERCADO_PAGO_TOKEN = 'APP_USR-4480456642803254-111801-be3d1e41d0eb72ba4a94bcd81ee19496-16180848';

console.log("Inicializando Supabase com URL fixa:", SUPABASE_URL);

// Inicialização oficial do cliente Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Inicialização do Mercado Pago com o token de produção
const client = new MercadoPagoConfig({ accessToken: MERCADO_PAGO_TOKEN });

// Porta configurada pelo Render ou padrão 10000
const PORT = process.env.PORT || 10000;

// Rota de verificação do servidor
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
