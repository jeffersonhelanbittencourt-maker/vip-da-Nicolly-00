const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();
app.use(express.json());

// Recuperação e validação rigorosa das Variáveis de Ambiente do Render
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_KEY;
const supabaseSecret = process.env.SUPABASE_SECRET_KEY;
const supabaseJwksUrl = process.env.SUPABASE_JWKS_URL;
const mercadoPagoToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

console.log("Validando URL do Supabase:", supabaseUrl ? "Presente" : "Ausente");

if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  console.error("ERRO CRÍTICO: SUPABASE_URL inválida ou não definida nas variáveis de ambiente do Render!");
}

// Inicialização segura do cliente Supabase
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder-key');

// Inicialização do Mercado Pago com o token de produção
const client = new MercadoPagoConfig({ accessToken: mercadoPagoToken || 'token_pendente' });

// Porta configurada pelo Render ou padrão 10000
const PORT = process.env.PORT || 10000;

// Rota de teste/verificação de saúde do servidor
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    app: 'VIP da Nicolly',
    supabaseConnected: Boolean(supabaseUrl),
    mercadoPagoConfigured: Boolean(mercadoPagoToken)
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
