const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { MercadoPagoConfig } = require('mercadopago');

const app = express();
app.use(express.json());

// Servir arquivos estáticos do front-end
app.use(express.static(path.join(__dirname)));

// Credenciais oficiais
const SUPABASE_URL = 'https://wodlhlwezckslounvmlx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gTnYby203YRRUb0DeNqcKg_Nqe0M9Yr';
const MERCADO_PAGO_TOKEN = 'APP_USR-4480456642803254-111801-be3d1e41d0eb72ba4a94bcd81ee19496-16180848';

console.log("Iniciando servidor para o VIP da Nicolly com painel Admin...");

const client = new MercadoPagoConfig({ accessToken: MERCADO_PAGO_TOKEN });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PORT = process.env.PORT || 10000;

// Lista de administradores autorizados e suas configurações iniciais
const ADMINS_AUTORIZADOS = [
  { email: 'jeffersonhelanbittencourt@gmail.com', senhaPadrao: '0411' }, // Substitua pelo seu e-mail exato se necessário
  { email: 'nicolly@vip.com', senhaPadrao: '0411' } // Exemplo para a Nicolly
];

// Rota para verificar se o usuário é Administrador
app.get('/papel', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: 'Não autorizado' });

  try {
    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) return res.status(401).json({ success: false, message: 'Sessão inválida' });

    // Verifica se o e-mail do usuário está na lista de administradores
    const isAdmin = ADMINS_AUTORIZADOS.some(adm => adm.email.toLowerCase() === user.email.toLowerCase());

    res.json({ success: true, data: { admin: isAdmin } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro no servidor' });
  }
});

// Rota de status do servidor
app.get('/health', (req, res) => {
  res.json({ status: 'online', app: 'VIP da Nicolly' });
});

// Entrega o front-end em qualquer rota
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando perfeitamente na porta ${PORT}`);
});
