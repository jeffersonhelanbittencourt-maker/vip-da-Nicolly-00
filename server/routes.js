const express = require('express');
const CONFIG = require('./config');
const { supabaseAdmin } = require('./db');
const { criarCobrancaPix, consultarStatusPix } = require('./pix');

const router = express.Router();

// Middleware de verificação de token do Supabase enviado pelo cliente
async function verificarAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, code: 'SESSAO_EXPIRADA', message: 'Sessão não encontrada.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ success: false, code: 'SESSAO_EXPIRADA', message: 'Sessão inválida ou expirada.' });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, code: 'SESSAO_EXPIRADA', message: 'Erro ao autenticar usuário.' });
  }
}

// 1. Health check
router.get('/health', (req, res) => {
  res.json({ success: true, status: 'online', timestamp: new Date().toISOString() });
});

// 2. Verificar se usuário é Admin
router.get('/papel', verificarAuth, async (req, res) => {
  const email = req.user.email;
  const isAdmin = email === CONFIG.ADMIN_EMAIL;
  if (isAdmin) {
    await supabaseAdmin.from('admins_vip').upsert({ email, nivel: 'master', ativo: true }, { onConflict: 'email' });
  }
  res.json({ success: true, data: { admin: isAdmin, email } });
});

// 3. Criar Pagamento Pix
router.post('/criar-pagamento', verificarAuth, async (req, res) => {
  const { plano, cupom } = req.body;
  const email = req.user.email;

  const precos = { semanal: 25.00, mensal: 50.00, vitalicio: 200.00 };
  let valor = precos[plano];
  if (!valor) {
    return res.status(400).json({ success: false, message: 'Plano inválido.' });
  }

  // Validação de cupom opcional
  if (cupom) {
    const { data: cup } = await supabaseAdmin.from('cupons_vip').select('*').eq('codigo', cupom.toUpperCase()).eq('ativo', true).single();
    if (cup) {
      const desconto = (valor * cup.percentual) / 100;
      valor = Number((valor - desconto).toFixed(2));
    }
  }

  try {
    const pixRes = await criarCobrancaPix({ valor, plano, email });

    // Salvar registro na tabela de pagamentos
    await supabaseAdmin.from('pagamentos_vip').insert({
      payment_id: pixRes.payment_id,
      email: email,
      plano: plano,
      valor: valor,
      cupom: cupom || null,
      status: 'pendente'
    });

    // Garantir registro na tabela de clientes
    await supabaseAdmin.from('clientes_vip').upsert({
      email: email,
      plano: plano,
      status: 'pendente',
      payment_id: pixRes.payment_id,
      valor_pago: valor
    }, { onConflict: 'email' });

    res.json({ success: true, data: pixRes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Erro ao gerar Pix.' });
  }
});

// 4. Verificar Status do Pagamento
router.get('/verificar-status', verificarAuth, async (req, res) => {
  const email = req.query.email || req.user.email;
  if (email !== req.user.email && req.user.email !== CONFIG.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Acesso negado.' });
  }

  const { data: cliente } = await supabaseAdmin.from('clientes_vip').select('*').eq('email', email).single();
  if (!cliente) {
    return res.json({ success: true, data: { email, status: 'pendente', plano: '', expira_em: null, expirado: false } });
  }

  // Se tiver payment_id pendente, consulta no Mercado Pago
  if (cliente.status === 'pendente' && cliente.payment_id) {
    const mpStatus = await consultarStatusPix(cliente.payment_id);
    if (mpStatus && mpStatus.status === 'approved') {
      let dias = 30;
      if (cliente.plano === 'semanal') dias = 7;
      if (cliente.plano === 'vitalicio') dias = 36500;

      const expiraEm = new Date();
      expiraEm.setDate(expiraEm.getDate() + dias);

      await supabaseAdmin.from('clientes_vip').update({
        status: 'aprovado',
        expira_em: expiraEm.toISOString()
      }).eq('email', email);

      await supabaseAdmin.from('pagamentos_vip').update({ status: 'aprovado' }).eq('payment_id', cliente.payment_id);

      cliente.status = 'aprovado';
      cliente.expira_em = expiraEm.toISOString();
    }
  }

  const expirado = cliente.expira_em ? new Date(cliente.expira_em) < new Date() : false;
  res.json({
    success: true,
    data: {
      email: cliente.email,
      plano: cliente.plano,
      status: expirado ? 'expirado' : cliente.status,
      expira_em: cliente.expira_em,
      expirado
    }
  });
});

// 5. Validar Cupom de Desconto
router.post('/validar-cupom', verificarAuth, async (req, res) => {
  const { plano, cupom } = req.body;
  const precos = { semanal: 25.00, mensal: 50.00, vitalicio: 200.00 };
  const base = precos[plano];
  if (!base || !cupom) {
    return res.status(400).json({ success: false, message: 'Dados inválidos.' });
  }

  const { data: cup } = await supabaseAdmin.from('cupons_vip').select('*').eq('codigo', cupom.toUpperCase()).eq('ativo', true).single();
  if (!cup) {
    return res.status(404).json({ success: false, message: 'Cupom inválido ou expirado.' });
  }

  const valorFinal = Number((base - (base * cup.percentual) / 100).toFixed(2));
  res.json({
    success: true,
    data: { codigo: cup.codigo, percentual: cup.percentual, valor_final: valorFinal }
  });
});

// 6. Listar Clientes (Painel Admin)
router.get('/listar-clientes', verificarAuth, async (req, res) => {
  if (req.user.email !== CONFIG.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Requer privilégios administrativos.' });
  }
  const { data, error } = await supabaseAdmin.from('clientes_vip').select('*').order('criado_em', { ascending: false });
  if (error) return res.status(500).json({ success: false, message: 'Erro ao buscar clientes.' });

  const clientesFormatados = (data || []).map(c => ({
    ...c,
    expirado: c.expira_em ? new Date(c.expira_em) < new Date() : false
  }));

  res.json({ success: true, data: clientesFormatados });
});

// 7. Atualizar Status de Cliente (Painel Admin)
router.post('/atualizar-status', verificarAuth, async (req, res) => {
  if (req.user.email !== CONFIG.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Requer privilégios administrativos.' });
  }
  const { email, status } = req.body;
  if (!email || !['aprovado', 'suspenso', 'pendente'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Parâmetros inválidos.' });
  }

  let expiraEm = null;
  if (status === 'aprovado') {
    const d = new Date();
    d.setDate(d.getDate() + 30); // Padrão 30 dias para aprovação manual
    expiraEm = d.toISOString();
  }

  const { error } = await supabaseAdmin.from('clientes_vip').update({ status, expira_em: expiraEm }).eq('email', email);
  if (error) return res.status(500).json({ success: false, message: 'Erro ao atualizar status.' });

  res.json({ success: true, message: 'Status atualizado com sucesso.' });
});

// 8. Métricas Financeiras e Operacionais (Painel Admin)
router.get('/metricas', verificarAuth, async (req, res) => {
  if (req.user.email !== CONFIG.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Requer privilégios administrativos.' });
  }

  const { data: clientes } = await supabaseAdmin.from('clientes_vip').select('status, plano');
  const { data: pags } = await supabaseAdmin.from('pagamentos_vip').select('valor, status');

  const ativos = (clientes || []).filter(c => c.status === 'aprovado').length;
  const pendentes = (clientes || []).filter(c => c.status === 'pendente').length;
  const totalCadastros = (clientes || []).length;
  const conversao = totalCadastros > 0 ? Number(((ativos / totalCadastros) * 100).toFixed(1)) : 0;

  const faturamento = (pags || []).filter(p => p.status === 'aprovado').reduce((acc, p) => acc + Number(p.valor || 0), 0);

  res.json({
    success: true,
    data: { ativos, pendentes, conversao, faturamento }
  });
});

// 9. Obter Configurações (Link do WhatsApp)
router.get('/config', verificarAuth, async (req, res) => {
  const { data } = await supabaseAdmin.from('configuracoes').select('*');
  const mapa = {};
  (data || []).forEach(item => { mapa[item.chave] = item.valor; });
  res.json({
    success: true,
    data: {
      link_whatsapp: mapa['link_grupo_vip'] || '',
      emails_notificacao: mapa['suporte_whatsapp'] || ''
    }
  });
});

// 10. Salvar Configurações (Painel Admin)
router.post('/salvar-config', verificarAuth, async (req, res) => {
  if (req.user.email !== CONFIG.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Requer privilégios administrativos.' });
  }
  const { link_whatsapp, emails_notificacao } = req.body;

  await supabaseAdmin.from('configuracoes').upsert({ chave: 'link_grupo_vip', valor: link_whatsapp });
  await supabaseAdmin.from('configuracoes').upsert({ chave: 'suporte_whatsapp', valor: emails_notificacao });

  res.json({ success: true, message: 'Configurações salvas.' });
});

// 11. Obter Link do Grupo VIP Protegido
router.get('/link-vip', verificarAuth, async (req, res) => {
  const email = req.user.email;
  const { data: cliente } = await supabaseAdmin.from('clientes_vip').select('status, expira_em').eq('email', email).single();

  const aprovado = cliente && cliente.status === 'aprovado' && (!cliente.expira_em || new Date(cliente.expira_em) > new Date());
  if (!aprovado && email !== CONFIG.ADMIN_EMAIL) {
    return res.status(403).json({ success: false, message: 'Acesso ao grupo bloqueado. Regularize sua assinatura.' });
  }

  const { data: cfg } = await supabaseAdmin.from('configuracoes').select('valor').eq('chave', 'link_grupo_vip').single();
  const link = cfg ? cfg.valor : '';

  if (!link) {
    return res.status(404).json({ success: false, message: 'O link do grupo ainda não foi configurado pelo administrador.' });
  }

  res.json({ success: true, data: { link } });
});

module.exports = router;
