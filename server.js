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

console.log("Iniciando servidor para o VIP da Nicolly com controle de Admin e Senha Padrão...");

const client = new MercadoPagoConfig({ accessToken: MERCADO_PAGO_TOKEN });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PORT = process.env.PORT || 10000;

// Lista de usuários autorizados (Admin e Nicolly) com senha padrão 0411
const USUARIOS_AUTORIZADOS = [
  { nome: 'Jefferson', email: 'jeffersonhelanbittencourt@gmail.com', admin: true },
  { nome: 'Nicolly', email: 'nicolly@vip.com', admin: false }
];

// Rota para verificar o papel e se precisa trocar a senha padrão
app.get('/papel', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: 'Não autorizado' });

  try {
    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) return res.status(401).json({ success: false, message: 'Sessão inválida' });

    const cadastro = USUARIOS_AUTORIZADOS.find(u => u.email.toLowerCase() === user.email.toLowerCase());
    const isAdmin = cadastro ? cadastro.admin : false;

    res.json({ success: true, data: { admin: isAdmin, nome: cadastro ? cadastro.nome : 'Usuário' } });
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
