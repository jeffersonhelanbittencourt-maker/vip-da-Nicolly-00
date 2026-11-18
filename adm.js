/* =============================================================================
 * VIP DA NICOLLY - adm.js (Módulo de Administração Separado)
 * ========================================================================== */
const express = require('express');
const router = express.Router();

// Lista de usuários autorizados com privilégio explícito de Administrador
const USUARIOS_ADM = [
  { 
    login: 'jeffersonhelanbittencourt@gmail.com', 
    senha: '041160', 
    nome: 'Jefferson', 
    admin: true,
    role: 'admin'
  }
];

// Rota de login do admin que conversa com o servidor e libera o painel de adm
router.post('/login-admin', (req, res) => {
  const { login, senha } = req.body;
  const usuarioDigitado = String(login || '').trim().toLowerCase();
  const senhaDigitada = String(senha || '').trim();

  const encontrado = USUARIOS_ADM.find(u => u.login === usuarioDigitado && u.senha === senhaDigitada);

  if (encontrado) {
    res.json({ 
      success: true, 
      data: {
        login: encontrado.login,
        nome: encontrado.nome,
        admin: true,
        role: 'admin'
      } 
    });
  } else {
    res.status(401).json({ success: false, message: 'Usuário ou senha incorretos' });
  }
});

// Rota de papel do usuário garantindo status de administrador
router.get('/papel', (req, res) => {
  res.json({ 
    success: true, 
    data: { 
      admin: true, 
      role: 'admin',
      nome: 'Jefferson' 
    } 
  });
});

module.exports = router;
