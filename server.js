const express = require('express');
const path = require('path');

// Importa os módulos separados
const db = require('./db');
const admRouter = require('./adm');
const pixRouter = require('./pix');

const app = express();
app.use(express.json());

// Configura o Express para servir todos os arquivos estáticos da raiz do projeto
app.use(express.static(path.join(__dirname)));

console.log("Iniciando servidor principal para o VIP da Nicolly...");

const PORT = process.env.PORT || 10000;

// Rota de status/healthcheck do servidor
app.get('/health', (req, res) => {
  res.json({ status: 'online', app: 'VIP da Nicolly' });
});

// Conecta as rotas de Administração e Pix sob o prefixo /api
app.use('/api', admRouter);
app.use('/api', pixRouter);

// Rota de verificação de status usando o módulo de banco de dados (db.js)
app.get('/verificar-status', async (req, res) => {
  const email = req.query.email;
  // Exemplo de consulta integrada ao banco de dados se necessário
  res.json({ success: true, data: { email: email, status: 'pendente', plano: '' } });
});

// Rota para garantir que links de confirmação de e-mail abram o site corretamente
app.get('/auth/callback', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Qualquer outra rota exibe o seu arquivo index.html principal do site
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando perfeitamente na porta ${PORT}`);
});
