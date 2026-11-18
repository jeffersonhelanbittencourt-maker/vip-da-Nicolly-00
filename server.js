'use strict';

/* =============================================================================
 * VIP DA NICOLLY - BACK-END (Node.js / Express)
 * =============================================================================
 *
 * VARIÁVEIS DE AMBIENTE (configure no painel da hospedagem: Render, Railway...)
 *   SUPABASE_URL      URL do projeto Supabase
 *   SUPABASE_KEY      Chave "service_role" do Supabase (SOMENTE no servidor!)
 *   MP_ACCESS_TOKEN   Access Token de produção do Mercado Pago
 *   ADMIN_EMAILS      E-mails administradores separados por vírgula
 *                     (ex.: jefihelan@hotmail.com,email.da.nicolly@gmail.com)
 *   PUBLIC_URL        (opcional) URL pública deste servidor, usada no webhook
 *                     do Mercado Pago (ex.: https://vip-nicolly.onrender.com)
 *   MP_WEBHOOK_SECRET Assinatura secreta do webhook (Mercado Pago Developers >
 *                     Suas integrações > Webhooks). Ativa a validação x-signature
 *   WHATSAPP_LINK     (opcional) link de convite do grupo, caso a tabela
 *                     "configuracoes" ainda não tenha o valor
 *   PORT              Porta (a hospedagem define; fallback local 3000)
 *
 * SCHEMA SQL (rode uma vez no SQL Editor do Supabase)
 *
 *   create table if not exists public.clientes_vip (
 *     id            uuid primary key default gen_random_uuid(),
 *     email         text not null unique,
 *     plano         text,
 *     status        text not null default 'pendente'
 *                   check (status in ('pendente','aprovado','suspenso')),
 *     payment_id    text,
 *     expira_em     timestamptz,
 *     criado_em     timestamptz not null default now(),
 *     atualizado_em timestamptz not null default now()
 *   );
 *   create unique index if not exists clientes_vip_email_idx
 *     on public.clientes_vip (email);
 *
 *   create table if not exists public.configuracoes (
 *     chave         text primary key,
 *     valor         text,
 *     atualizado_em timestamptz not null default now()
 *   );
 *
 *   -- Parte 2: valor efetivamente pago e cupons de desconto
 *   alter table public.clientes_vip
 *     add column if not exists valor_pago numeric(10,2) not null default 0;
 *
 *   create table if not exists public.cupons_vip (
 *     codigo      text primary key check (codigo = upper(codigo)),
 *     percentual  integer not null check (percentual between 1 and 90),
 *     limite_uso  integer,
 *     usos        integer not null default 0,
 *     ativo       boolean not null default true,
 *     expira_em   timestamptz,
 *     criado_em   timestamptz not null default now()
 *   );
 *   alter table public.cupons_vip enable row level security;
 *   -- exemplo: insert into public.cupons_vip (codigo, percentual, limite_uso)
 *   --          values ('BEMVINDA15', 15, 100);
 *
 *   -- Ninguém acessa as tabelas direto pelo navegador: tudo passa por este
 *   -- servidor (a chave service_role ignora o RLS).
 *   alter table public.clientes_vip  enable row level security;
 *   alter table public.configuracoes enable row level security;
 *
 * No Supabase Auth, mantenha "Confirm email" ATIVADO: o painel admin só aceita
 * e-mails confirmados, evitando que alguém cadastre um e-mail admin que não é seu.
 * ========================================================================== */

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { MercadoPagoConfig, Payment } = require('mercadopago');

// -----------------------------------------------------------------------------
// 1. CONFIGURAÇÃO
// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wodlhlwezckslounvmlx.supabase.co';
// Fallback de DESENVOLVIMENTO (chave pública). Em produção use a service_role.
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_gTnYby203YRRUb0DeNqcKg_Nqe0M9Yr';
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'jefihelan@hotmail.com')
  .split(',')
  .map(function (e) { return e.trim().toLowerCase(); })
  .filter(function (e) { return e.length > 0; });

const TABELA_CLIENTES = 'clientes_vip';
const TABELA_CONFIG = 'configuracoes';
const STATUS_PERMITIDOS = ['aprovado', 'pendente', 'suspenso'];
const TABELA_CUPONS = 'cupons_vip';
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || '';

// Valores sempre definidos aqui no servidor (nunca confiar no valor vindo do navegador)
const PLANOS = {
  semanal: { nome: 'Plano Semanal (7 Dias)', valor: 25.00, dias: 7 },
  mensal: { nome: 'Plano Mensal (30 Dias)', valor: 50.00, dias: 30 },
  vitalicio: { nome: 'Plano Vitalício (Permanente)', valor: 200.00, dias: null }
};

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

let mpPayment = null;

/**
 * Retorna a instância do Payment do Mercado Pago SDK v2 (criada sob demanda).
 * @returns {Payment|null} null quando MP_ACCESS_TOKEN não está configurado.
 */
function obterMercadoPago() {
  if (!MP_ACCESS_TOKEN) return null;
  if (!mpPayment) {
    const client = new MercadoPagoConfig({
      accessToken: MP_ACCESS_TOKEN,
      options: { timeout: 10000 }
    });
    mpPayment = new Payment(client);
  }
  return mpPayment;
}

// -----------------------------------------------------------------------------
// 2. UTILITÁRIOS (logs, respostas padronizadas, validações)
// -----------------------------------------------------------------------------

/**
 * Log estruturado com timestamp.
 * @param {string} nivel INFO | WARN | ERRO | SEGURANCA
 * @param {string} mensagem Texto do log.
 */
function log(nivel, mensagem) {
  console.log('[' + new Date().toISOString() + '] [' + nivel + '] ' + mensagem);
}

/**
 * Resposta JSON padronizada: { success, message, data? } (+ campos extras).
 * @param {object} res Resposta Express.
 * @param {number} status Código HTTP.
 * @param {boolean} success Resultado da operação.
 * @param {string} message Mensagem legível.
 * @param {*} [data] Dados da resposta.
 * @param {object} [extra] Campos adicionais no nível raiz.
 */
function enviar(res, status, success, message, data, extra) {
  const corpo = { success: success, message: message };
  if (data !== undefined && data !== null) corpo.data = data;
  if (extra) Object.assign(corpo, extra);
  return res.status(status).json(corpo);
}

/**
 * Normaliza e-mail: string, sem espaços nas pontas, minúsculo.
 * @param {*} valor Valor recebido.
 * @returns {string}
 */
function limparEmail(valor) {
  return typeof valor === 'string' ? valor.trim().toLowerCase() : '';
}

/**
 * Valida o formato do e-mail e bloqueia caracteres de escape suspeitos.
 * @param {string} email E-mail já normalizado.
 * @returns {boolean}
 */
function emailValido(email) {
  return email.length > 3 && email.length <= 254 &&
    /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);
}

/**
 * Calcula a data de expiração de um plano.
 * @param {string} plano Chave do plano.
 * @returns {string|null} ISO de expiração ou null (vitalício/desconhecido).
 */
function calcularExpiracao(plano) {
  const def = PLANOS[plano];
  if (!def || !def.dias) return null;
  return new Date(Date.now() + def.dias * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Status efetivo: um plano aprovado com data vencida volta a "pendente".
 * @param {object|null} row Linha da tabela.
 * @returns {string}
 */
function statusEfetivo(row) {
  const s = row && row.status ? row.status : 'pendente';
  if (s === 'aprovado' && row.expira_em && new Date(row.expira_em).getTime() < Date.now()) {
    return 'pendente';
  }
  return s;
}

/**
 * Converte uma linha do banco em objeto limpo (sem null/undefined).
 * @param {object|null} row Linha da tabela clientes_vip.
 * @param {string} [emailPadrao] E-mail usado se a linha não existir.
 * @returns {object}
 */
function normalizarCliente(row, emailPadrao) {
  const r = row || {};
  const expirado = r.status === 'aprovado' && !!r.expira_em &&
    new Date(r.expira_em).getTime() < Date.now();
  return {
    email: r.email || emailPadrao || '',
    plano: r.plano || '',
    status: statusEfetivo(r),
    expira_em: r.expira_em || '',
    criado_em: r.criado_em || '',
    valor_pago: Number(r.valor_pago) || 0,
    expirado: expirado
  };
}

/**
 * Rate limiting básico em memória (por e-mail autenticado ou IP).
 * @param {number} maximo Requisições permitidas na janela.
 * @param {number} janelaMs Tamanho da janela em ms.
 * @returns {Function} Middleware Express.
 */
function limitar(maximo, janelaMs) {
  const registros = new Map();
  setInterval(function () {
    const agora = Date.now();
    registros.forEach(function (lista, chave) {
      const recentes = lista.filter(function (t) { return agora - t < janelaMs; });
      if (recentes.length === 0) registros.delete(chave); else registros.set(chave, recentes);
    });
  }, janelaMs).unref();

  return function (req, res, next) {
    const chave = (req.user && req.user.email) || req.ip;
    const agora = Date.now();
    const lista = (registros.get(chave) || []).filter(function (t) { return agora - t < janelaMs; });
    if (lista.length >= maximo) {
      log('SEGURANCA', 'Rate limit atingido para ' + chave + ' em ' + req.path);
      return enviar(res, 429, false, 'Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.');
    }
    lista.push(agora);
    registros.set(chave, lista);
    return next();
  };
}

// -----------------------------------------------------------------------------
// 3. ACESSO AO BANCO (Supabase) - somente a tabela clientes_vip / configuracoes
// -----------------------------------------------------------------------------

/**
 * Busca um cliente pelo e-mail pedindo só as colunas necessárias.
 * @param {string} email E-mail normalizado.
 * @returns {Promise<object|null>}
 */
async function buscarCliente(email) {
  const { data, error } = await supabase
    .from(TABELA_CLIENTES)
    .select('email,plano,status,payment_id,expira_em,criado_em')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * Lê um valor da tabela configuracoes.
 * @param {string} chave Nome da configuração.
 * @returns {Promise<string>} Valor ou string vazia.
 */
async function obterConfig(chave) {
  try {
    const { data, error } = await supabase
      .from(TABELA_CONFIG)
      .select('valor')
      .eq('chave', chave)
      .maybeSingle();
    if (error) throw error;
    return data && data.valor ? String(data.valor) : '';
  } catch (err) {
    log('ERRO', 'Falha ao ler configuração "' + chave + '": ' + err.message);
    return '';
  }
}

// -----------------------------------------------------------------------------
// 4. MERCADO PAGO (sincronização de pagamento aprovado)
// -----------------------------------------------------------------------------

/**
 * Resolve e valida um cupom para um plano. Cálculo em centavos inteiros
 * (sem erro de arredondamento): desconto = floor(valor * percentual / 100).
 * @param {*} codigoBruto Código digitado pelo cliente (opcional).
 * @param {object} def Definição do plano (PLANOS[x]).
 * @returns {Promise<object>} { ok, mensagem?, cupom, valor, valorOriginal }
 */
async function resolverCupom(codigoBruto, def) {
  const centavosOriginal = Math.round(def.valor * 100);
  const codigo = typeof codigoBruto === 'string' ? codigoBruto.trim().toUpperCase() : '';
  if (!codigo) {
    return { ok: true, cupom: null, valor: centavosOriginal / 100, valorOriginal: def.valor };
  }
  if (!/^[A-Z0-9_-]{3,32}$/.test(codigo)) {
    return { ok: false, mensagem: 'Cupom inválido.' };
  }

  const { data, error } = await supabase
    .from(TABELA_CUPONS)
    .select('codigo,percentual,limite_uso,usos,ativo,expira_em')
    .eq('codigo', codigo)
    .maybeSingle();
  if (error) throw error;

  if (!data || !data.ativo) return { ok: false, mensagem: 'Cupom inválido ou inativo.' };
  if (data.expira_em && new Date(data.expira_em).getTime() < Date.now()) {
    return { ok: false, mensagem: 'Este cupom expirou.' };
  }
  if (data.limite_uso !== null && Number(data.usos) >= Number(data.limite_uso)) {
    return { ok: false, mensagem: 'Este cupom atingiu o limite de usos.' };
  }
  const pct = Number(data.percentual);
  if (!(pct >= 1 && pct <= 90)) return { ok: false, mensagem: 'Cupom inválido.' };

  const final = centavosOriginal - Math.floor(centavosOriginal * pct / 100);
  if (final <= 0) return { ok: false, mensagem: 'Cupom inválido.' };

  return {
    ok: true,
    cupom: { codigo: data.codigo, percentual: pct },
    valor: final / 100,
    valorOriginal: def.valor
  };
}

/**
 * Soma 1 ao contador de usos do cupom (trava otimista: só atualiza se o
 * contador não mudou desde a leitura). Falhas apenas geram log.
 * @param {string} codigo Código do cupom.
 */
async function registrarUsoCupom(codigo) {
  try {
    const { data, error } = await supabase
      .from(TABELA_CUPONS).select('usos').eq('codigo', codigo).maybeSingle();
    if (error || !data) throw (error || new Error('cupom não encontrado'));
    const { error: erroUp } = await supabase
      .from(TABELA_CUPONS).update({ usos: Number(data.usos) + 1 })
      .eq('codigo', codigo).eq('usos', data.usos);
    if (erroUp) throw erroUp;
  } catch (err) {
    log('WARN', 'Não foi possível registrar o uso do cupom ' + codigo + ': ' + err.message);
  }
}

/**
 * Valida a assinatura x-signature do webhook do Mercado Pago:
 * HMAC-SHA256 do manifesto "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * usando MP_WEBHOOK_SECRET. Sem o segredo configurado, apenas avisa no log
 * (o pagamento continua sendo confirmado direto na API do Mercado Pago).
 */
function verificarAssinaturaWebhook(req, res, next) {
  if (!MP_WEBHOOK_SECRET) {
    log('WARN', 'MP_WEBHOOK_SECRET ausente: assinatura do webhook NÃO validada.');
    return next();
  }
  const partes = {};
  String(req.headers['x-signature'] || '').split(',').forEach(function (trecho) {
    const i = trecho.indexOf('=');
    if (i > 0) partes[trecho.slice(0, i).trim()] = trecho.slice(i + 1).trim();
  });
  const requestId = String(req.headers['x-request-id'] || '');
  const corpo = req.body || {};
  const dataId = String(req.query['data.id'] || (corpo.data && corpo.data.id) || '').toLowerCase();

  if (!partes.ts || !partes.v1 || !dataId) {
    log('SEGURANCA', 'Webhook sem x-signature válida de ' + req.ip);
    return enviar(res, 401, false, 'Assinatura ausente ou inválida.');
  }
  const manifesto = 'id:' + dataId + ';request-id:' + requestId + ';ts:' + partes.ts + ';';
  const esperado = crypto.createHmac('sha256', MP_WEBHOOK_SECRET).update(manifesto).digest('hex');
  const a = Buffer.from(esperado);
  const b = Buffer.from(partes.v1);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    log('SEGURANCA', 'Webhook com assinatura divergente de ' + req.ip + ' (id ' + dataId + ')');
    return enviar(res, 401, false, 'Assinatura ausente ou inválida.');
  }
  return next();
}

/**
 * Consulta o pagamento direto na API do Mercado Pago e, se estiver aprovado e
 * for coerente com o plano, libera o acesso do cliente no Supabase.
 * Regras: valor e método (pix) conferidos; clientes suspensos nunca são
 * liberados automaticamente; chamada idempotente.
 * @param {string|number} paymentId ID do pagamento no Mercado Pago.
 * @returns {Promise<boolean>} true se o cliente ficou (ou já estava) aprovado.
 */
async function sincronizarPagamento(paymentId) {
  const mp = obterMercadoPago();
  if (!mp) throw new Error('MP_ACCESS_TOKEN ausente.');

  const pagamento = await mp.get({ id: paymentId });
  if (!pagamento || pagamento.status !== 'approved') return false;

  const meta = pagamento.metadata || {};
  const email = limparEmail(meta.email);
  const planoChave = typeof meta.plano === 'string' ? meta.plano : '';
  const def = PLANOS[planoChave];

  if (!emailValido(email) || !def) {
    log('WARN', 'Pagamento ' + paymentId + ' aprovado sem metadados válidos. Ignorado.');
    return false;
  }
  // Valor esperado = valor gravado por nós nos metadados (plano com cupom aplicado)
  const valorMeta = Number(meta.valor);
  const esperado = (Number.isFinite(valorMeta) && valorMeta > 0 && valorMeta <= def.valor) ? valorMeta : def.valor;
  if (Math.round(Number(pagamento.transaction_amount) * 100) !== Math.round(esperado * 100) || pagamento.payment_method_id !== 'pix') {
    log('SEGURANCA', 'Pagamento ' + paymentId + ' com valor/método divergente do plano ' + planoChave + '. Ignorado.');
    return false;
  }

  const existente = await buscarCliente(email);
  if (existente && existente.status === 'suspenso') {
    log('SEGURANCA', 'Pagamento ' + paymentId + ' de cliente suspenso (' + email + '). Não liberado.');
    return false;
  }
  if (existente && existente.status === 'aprovado' && String(existente.payment_id) === String(pagamento.id)) {
    return true;
  }
  if (existente && statusEfetivo(existente) === 'aprovado') {
    log('WARN', 'Pagamento extra ' + paymentId + ' para cliente já ativo (' + email + '). Verifique manualmente.');
    return true;
  }

  const { error } = await supabase.from(TABELA_CLIENTES).upsert({
    email: email,
    plano: planoChave,
    status: 'aprovado',
    payment_id: String(pagamento.id),
    valor_pago: Number(pagamento.transaction_amount),
    expira_em: calcularExpiracao(planoChave),
    atualizado_em: new Date().toISOString()
  }, { onConflict: 'email' });
  if (error) throw error;

  if (typeof meta.cupom === 'string' && meta.cupom) await registrarUsoCupom(meta.cupom);

  log('INFO', '[API] Status atualizado com sucesso para aprovado: ' + email + ' (' + planoChave + ')');
  return true;
}

/**
 * Traduz um erro do SDK do Mercado Pago em resposta HTTP descritiva.
 * @param {object} res Resposta Express.
 * @param {Error} err Erro capturado.
 */
function responderErroMercadoPago(res, err) {
  const status = err && (err.status || err.statusCode);
  const texto = String((err && err.message) || 'erro desconhecido');
  log('ERRO', '[API] Falha ao gerar Pix no Mercado Pago: ' + texto);

  const erroChave = status === 401 || status === 403 || /access.?token|unauthorized|invalid.?credentials/i.test(texto);
  const mensagem = erroChave
    ? 'Falha na chave de API do Mercado Pago. Verifique o MP_ACCESS_TOKEN configurado no servidor.'
    : 'Não foi possível gerar o Pix agora. Tente gerar novamente em instantes.';

  return enviar(res, 502, false, mensagem, {
    status: 'erro',
    detalhe: texto.slice(0, 300)
  }, { status: 'erro' });
}

// -----------------------------------------------------------------------------
// 5. APLICAÇÃO EXPRESS E MIDDLEWARES GLOBAIS
// -----------------------------------------------------------------------------
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Cabeçalhos de segurança
app.use(function (req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// CORS + pré-flight OPTIONS respondido imediatamente com 200
// (Authorization é necessário para enviar o token de sessão do Supabase)
app.use(cors({
  origin: '*',
  methods: 'GET, POST, OPTIONS',
  allowedHeaders: 'Content-Type, Authorization',
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '1mb' }));

// Entrega apenas os 3 arquivos públicos do front-end (nunca server.js/package.json)
app.get(['/', '/index.html'], function (req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/style.css', function (req, res) {
  res.sendFile(path.join(__dirname, 'style.css'));
});
app.get('/script.js', function (req, res) {
  res.sendFile(path.join(__dirname, 'script.js'));
});

/**
 * Registra uma rota aceitando apenas o método indicado (405 para os demais).
 * @param {string} metodo GET | POST
 * @param {string} caminho Caminho da rota.
 * @param {Function[]} handlers Middlewares e handler final.
 */
function rota(metodo, caminho, handlers) {
  function verificarMetodo(req, res, next) {
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    if (req.method !== metodo) {
      res.setHeader('Allow', metodo + ', OPTIONS');
      return enviar(res, 405, false, 'Método ' + req.method + ' não permitido nesta rota. Use ' + metodo + '.');
    }
    return next();
  }
  const encadeados = handlers.map(function (fn) {
    return function (req, res, next) {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  });
  app.all(caminho, [verificarMetodo].concat(encadeados));
}

// -----------------------------------------------------------------------------
// 6. AUTENTICAÇÃO / AUTORIZAÇÃO (token JWT do Supabase Auth)
// -----------------------------------------------------------------------------

/**
 * Exige "Authorization: Bearer <token>" e valida o token no Supabase Auth.
 * O e-mail do solicitante vem SEMPRE do token, nunca do corpo da requisição.
 */
async function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const partes = cabecalho.match(/^Bearer\s+(.+)$/i);
  if (!partes) {
    return enviar(res, 401, false, 'Faça login para continuar.', null, { code: 'SESSAO_EXPIRADA' });
  }
  const { data, error } = await supabase.auth.getUser(partes[1]);
  if (error || !data || !data.user || !data.user.email) {
    return enviar(res, 401, false, 'Sua sessão expirou. Entre novamente.', null, { code: 'SESSAO_EXPIRADA' });
  }
  req.user = {
    id: data.user.id,
    email: data.user.email.toLowerCase(),
    confirmado: !!data.user.email_confirmed_at
  };
  return next();
}

/**
 * Indica se o usuário é administrador master (e-mail autorizado e confirmado).
 * @param {object} user Usuário autenticado.
 * @returns {boolean}
 */
function ehAdmin(user) {
  return !!user && user.confirmado === true && ADMIN_EMAILS.indexOf(user.email) !== -1;
}

/** Exige que o usuário autenticado seja administrador. */
function exigirAdmin(req, res, next) {
  if (!ehAdmin(req.user)) {
    log('SEGURANCA', 'Acesso admin NEGADO para ' + req.user.email + ' em ' + req.path);
    return enviar(res, 401, false, 'Você não tem permissão de administrador.', null, { code: 'SEM_PERMISSAO' });
  }
  return next();
}

// -----------------------------------------------------------------------------
// 7. ROTAS
// -----------------------------------------------------------------------------

// GET /health - ping de saúde para a hospedagem
rota('GET', '/health', [
  function (req, res) {
    return enviar(res, 200, true, 'Servidor online.', { uptime: Math.round(process.uptime()) });
  }
]);

// GET /papel - informa ao front-end se o usuário logado é administrador
rota('GET', '/papel', [
  autenticar,
  function (req, res) {
    return enviar(res, 200, true, 'Papel identificado.', { admin: ehAdmin(req.user), email: req.user.email });
  }
]);

/**
 * POST /criar-pagamento  body: { plano: 'semanal' | 'mensal' | 'vitalicio' }
 * Gera o Pix real no Mercado Pago e registra o cliente como "pendente"
 * (upsert por e-mail). Retorna status, qr_code_base64 e qr_code (copia e cola).
 */
rota('POST', '/criar-pagamento', [
  autenticar,
  limitar(6, 60 * 1000),
  async function (req, res) {
    const planoChave = typeof req.body.plano === 'string' ? req.body.plano.trim().toLowerCase() : '';
    const def = PLANOS[planoChave];
    if (!def) {
      return enviar(res, 400, false, 'Plano inválido. Escolha semanal, mensal ou vitalício.');
    }

    const mp = obterMercadoPago();
    if (!mp) {
      log('ERRO', '[API] MP_ACCESS_TOKEN ausente no ambiente.');
      return enviar(res, 500, false, 'Falha na chave de API do Mercado Pago: MP_ACCESS_TOKEN não configurado no servidor.', null, { status: 'erro' });
    }

    const email = req.user.email;
    log('INFO', '[API] Tentativa de criação de Pix para o e-mail: ' + email + ' (' + planoChave + ')');

    try {
      const existente = await buscarCliente(email);
      if (existente && existente.status === 'suspenso') {
        return enviar(res, 403, false, 'Seu acesso está suspenso. Fale com o suporte.');
      }
      if (existente && statusEfetivo(existente) === 'aprovado') {
        return enviar(res, 409, false, 'Você já possui um plano ativo. Acesse a Área do Cliente.');
      }

      let cupomInfo;
      try {
        cupomInfo = await resolverCupom(req.body.cupom, def);
      } catch (erroCupom) {
        log('ERRO', '[API] Falha ao validar cupom: ' + erroCupom.message);
        return enviar(res, 500, false, 'Não foi possível validar o cupom agora. Tente novamente ou gere o Pix sem cupom.');
      }
      if (!cupomInfo.ok) return enviar(res, 422, false, cupomInfo.mensagem);
      const valorFinal = cupomInfo.valor;
      if (!(valorFinal > 0)) return enviar(res, 422, false, 'Valor da cobrança inválido.');

      let pagamento;
      try {
        const corpo = {
          transaction_amount: valorFinal,
          description: 'VIP da Nicolly - ' + def.nome,
          payment_method_id: 'pix',
          external_reference: email,
          // Pix válido por 30 minutos
          date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString().replace('Z', '+00:00'),
          payer: { email: email },
          metadata: {
            email: email,
            plano: planoChave,
            valor: valorFinal,
            cupom: cupomInfo.cupom ? cupomInfo.cupom.codigo : ''
          }
        };
        if (PUBLIC_URL) corpo.notification_url = PUBLIC_URL + '/webhook';

        pagamento = await mp.create({
          body: corpo,
          requestOptions: { idempotencyKey: crypto.randomUUID() }
        });
      } catch (erroMp) {
        return responderErroMercadoPago(res, erroMp);
      }

      const dadosPix = pagamento && pagamento.point_of_interaction &&
        pagamento.point_of_interaction.transaction_data;
      if (!dadosPix || !dadosPix.qr_code || !dadosPix.qr_code_base64) {
        log('ERRO', '[API] Mercado Pago respondeu sem dados de QR Code para ' + email);
        return enviar(res, 502, false, 'O Mercado Pago não devolveu o QR Code. Tente gerar o Pix novamente.', null, { status: 'erro' });
      }

      const { error } = await supabase.from(TABELA_CLIENTES).upsert({
        email: email,
        plano: planoChave,
        status: 'pendente',
        payment_id: String(pagamento.id),
        expira_em: null,
        atualizado_em: new Date().toISOString()
      }, { onConflict: 'email' });
      if (error) throw error;

      log('INFO', '[API] Pix criado (pagamento ' + pagamento.id + ') para ' + email);
      return enviar(res, 201, true, 'Pix gerado com sucesso.', {
        status: pagamento.status,
        qr_code_base64: dadosPix.qr_code_base64,
        qr_code: dadosPix.qr_code,
        payment_id: String(pagamento.id)
      }, {
        status: pagamento.status,
        qr_code_base64: dadosPix.qr_code_base64,
        qr_code: dadosPix.qr_code
      });
    } catch (err) {
      log('ERRO', '[API] /criar-pagamento: ' + err.message);
      return enviar(res, 500, false, 'Erro de conexão com a nuvem. Tente novamente em instantes.');
    }
  }
]);

/**
 * POST /validar-cupom  body: { plano, cupom }
 * Informa o valor final do plano com o cupom aplicado (sem criar cobrança).
 */
rota('POST', '/validar-cupom', [
  autenticar,
  limitar(15, 60 * 1000),
  async function (req, res) {
    const planoChave = typeof req.body.plano === 'string' ? req.body.plano.trim().toLowerCase() : '';
    const def = PLANOS[planoChave];
    const codigo = typeof req.body.cupom === 'string' ? req.body.cupom.trim() : '';
    if (!def || !codigo) {
      return enviar(res, 400, false, 'Informe o plano e o código do cupom.');
    }
    try {
      const r = await resolverCupom(codigo, def);
      if (!r.ok) return enviar(res, 422, false, r.mensagem);
      return enviar(res, 200, true, 'Cupom aplicado.', {
        codigo: r.cupom.codigo,
        percentual: r.cupom.percentual,
        valor_original: r.valorOriginal,
        valor_final: r.valor
      });
    } catch (err) {
      log('ERRO', '[API] /validar-cupom: ' + err.message);
      return enviar(res, 500, false, 'Não foi possível validar o cupom agora. Você pode seguir com o valor integral.');
    }
  }
]);

/**
 * GET /verificar-status?email=<email do cliente>
 * Cliente consulta o próprio status (ou admin consulta qualquer um).
 * Se o Pix estiver pendente, confere o pagamento no Mercado Pago antes de responder.
 */
rota('GET', '/verificar-status', [
  autenticar,
  limitar(40, 60 * 1000),
  async function (req, res) {
    const email = limparEmail(req.query.email);
    if (!email || !emailValido(email)) {
      return enviar(res, 400, false, 'Informe um e-mail válido no parâmetro "email".');
    }
    if (email !== req.user.email && !ehAdmin(req.user)) {
      log('SEGURANCA', req.user.email + ' tentou consultar o status de ' + email);
      return enviar(res, 401, false, 'Você só pode consultar o seu próprio status.', null, { code: 'SEM_PERMISSAO' });
    }

    try {
      let row = await buscarCliente(email);
      if (row && row.status === 'pendente' && row.payment_id && obterMercadoPago()) {
        try {
          await sincronizarPagamento(row.payment_id);
          row = await buscarCliente(email);
        } catch (erroSync) {
          log('WARN', '[API] Não foi possível sincronizar o pagamento de ' + email + ': ' + erroSync.message);
        }
      }
      return enviar(res, 200, true, 'Status consultado.', normalizarCliente(row, email));
    } catch (err) {
      log('ERRO', '[API] /verificar-status: ' + err.message);
      return enviar(res, 500, false, 'Erro de conexão com a nuvem. Tente novamente em instantes.');
    }
  }
]);

/**
 * POST /webhook-mp  (chamado pelo Mercado Pago)
 * Não confia no corpo recebido: usa apenas o ID e consulta o pagamento na API
 * oficial com o nosso token.
 */
['/webhook', '/webhook-mp'].forEach(function (caminhoWebhook) {
rota('POST', caminhoWebhook, [
  verificarAssinaturaWebhook,
  async function (req, res) {
    const corpo = req.body || {};
    const tipo = corpo.type || req.query.type || req.query.topic || '';
    const idBruto = (corpo.data && corpo.data.id) || req.query['data.id'] || req.query.id || '';
    const id = String(idBruto);

    if (tipo !== 'payment' || !/^\d{3,20}$/.test(id)) {
      return enviar(res, 200, true, 'Notificação ignorada.');
    }
    try {
      log('INFO', '[API] Webhook Mercado Pago para pagamento ' + id);
      await sincronizarPagamento(id);
      return enviar(res, 200, true, 'Notificação processada.');
    } catch (err) {
      log('ERRO', '[API] /webhook-mp: ' + err.message);
      return enviar(res, 500, false, 'Falha ao processar a notificação.');
    }
  }
]);
});

/**
 * GET /link-vip
 * Entrega o link do grupo SOMENTE para cliente com status aprovado e vigente.
 */
rota('GET', '/link-vip', [
  autenticar,
  limitar(10, 60 * 1000),
  async function (req, res) {
    try {
      const row = await buscarCliente(req.user.email);
      if (!row || statusEfetivo(row) !== 'aprovado') {
        log('SEGURANCA', req.user.email + ' pediu o link VIP sem acesso aprovado.');
        return enviar(res, 403, false, 'Seu acesso ainda não foi liberado.', null, { code: 'SEM_PERMISSAO' });
      }
      const link = (await obterConfig('link_whatsapp')) || process.env.WHATSAPP_LINK || '';
      if (!link) {
        return enviar(res, 404, false, 'O link do grupo ainda não foi configurado. Fale com o suporte.');
      }
      log('INFO', '[API] Link VIP entregue para ' + req.user.email);
      return enviar(res, 200, true, 'Acesso liberado.', { link: link });
    } catch (err) {
      log('ERRO', '[API] /link-vip: ' + err.message);
      return enviar(res, 500, false, 'Erro de conexão com a nuvem. Tente novamente em instantes.');
    }
  }
]);

/** GET /listar-clientes - lista de clientes (somente administradores). */
rota('GET', '/listar-clientes', [
  autenticar,
  exigirAdmin,
  async function (req, res) {
    try {
      const { data, error } = await supabase
        .from(TABELA_CLIENTES)
        .select('email,plano,status,expira_em,criado_em,valor_pago')
        .order('criado_em', { ascending: false })
        .limit(500);
      if (error) throw error;
      const lista = (data || []).map(function (row) { return normalizarCliente(row); });
      return enviar(res, 200, true, 'Clientes carregados.', lista);
    } catch (err) {
      log('ERRO', '[API] /listar-clientes: ' + err.message);
      return enviar(res, 500, false, 'Erro de conexão com a nuvem. Tente novamente em instantes.');
    }
  }
]);

/**
 * POST /atualizar-status  body: { email, status }
 * status aceito: 'aprovado' | 'pendente' | 'suspenso' (somente administradores).
 */
rota('POST', '/atualizar-status', [
  autenticar,
  exigirAdmin,
  async function (req, res) {
    const email = limparEmail(req.body.email);
    const status = typeof req.body.status === 'string' ? req.body.status.trim().toLowerCase() : '';

    if (!email || !status) {
      return enviar(res, 400, false, 'Os campos "email" e "status" são obrigatórios.');
    }
    if (!emailValido(email)) {
      return enviar(res, 400, false, 'E-mail inválido.');
    }
    if (STATUS_PERMITIDOS.indexOf(status) === -1) {
      return enviar(res, 400, false, 'Status inválido. Use: ' + STATUS_PERMITIDOS.join(', ') + '.');
    }

    try {
      const row = await buscarCliente(email);
      if (!row) {
        return enviar(res, 404, false, 'Cliente não encontrado.');
      }

      const alteracao = { status: status, atualizado_em: new Date().toISOString() };
      if (status === 'aprovado' && row.status !== 'aprovado') {
        if (!row.plano || !PLANOS[row.plano]) {
          return enviar(res, 400, false, 'Este cliente ainda não escolheu um plano.');
        }
        alteracao.expira_em = calcularExpiracao(row.plano);
      }

      const { error } = await supabase.from(TABELA_CLIENTES).update(alteracao).eq('email', email);
      if (error) throw error;

      log('INFO', '[API] Status atualizado com sucesso para ' + status + ': ' + email + ' (por ' + req.user.email + ')');
      return enviar(res, 200, true, 'Status atualizado com sucesso.', { email: email, status: status });
    } catch (err) {
      log('ERRO', '[API] /atualizar-status: ' + err.message);
      return enviar(res, 500, false, 'Erro de conexão com a nuvem. Tente novamente em instantes.');
    }
  }
]);

/**
 * GET /metricas - cards do painel admin (somente administradores).
 * Faturamento = soma de valor_pago; conversão = pagantes / total de cadastros.
 */
rota('GET', '/metricas', [
  autenticar,
  exigirAdmin,
  async function (req, res) {
    try {
      const { data, error } = await supabase
        .from(TABELA_CLIENTES)
        .select('plano,status,expira_em,valor_pago')
        .limit(10000);
      if (error) throw error;

      const linhas = data || [];
      const m = { total: linhas.length, ativos: 0, pendentes: 0, suspensos: 0, expirados: 0, pagantes: 0 };
      let centavos = 0;
      linhas.forEach(function (row) {
        const c = normalizarCliente(row);
        if (c.status === 'aprovado') m.ativos += 1;
        else if (c.status === 'suspenso') m.suspensos += 1;
        else if (c.expirado) m.expirados += 1;
        else m.pendentes += 1;
        if (c.valor_pago > 0) {
          m.pagantes += 1;
          centavos += Math.round(c.valor_pago * 100);
        }
      });
      m.faturamento = centavos / 100;
      m.conversao = m.total > 0 ? Number((m.pagantes / m.total * 100).toFixed(1)) : 0;
      return enviar(res, 200, true, 'Métricas calculadas.', m);
    } catch (err) {
      log('ERRO', '[API] /metricas: ' + err.message);
      return enviar(res, 500, false, 'Erro de conexão com a nuvem. Tente novamente em instantes.');
    }
  }
]);

/** GET /config - configurações editáveis (somente administradores). */
rota('GET', '/config', [
  autenticar,
  exigirAdmin,
  async function (req, res) {
    const link = await obterConfig('link_whatsapp');
    const emails = await obterConfig('emails_notificacao');
    return enviar(res, 200, true, 'Configurações carregadas.', {
      link_whatsapp: link,
      emails_notificacao: emails
    });
  }
]);

/**
 * POST /salvar-config  body: { link_whatsapp, emails_notificacao }
 * Atualiza o link do grupo e os e-mails de notificação (somente administradores).
 */
rota('POST', '/salvar-config', [
  autenticar,
  exigirAdmin,
  async function (req, res) {
    const linkBruto = typeof req.body.link_whatsapp === 'string' ? req.body.link_whatsapp.trim() : '';
    const emailsBruto = typeof req.body.emails_notificacao === 'string' ? req.body.emails_notificacao.trim() : '';

    if (!linkBruto) {
      return enviar(res, 400, false, 'Informe o link de convite do grupo do WhatsApp.');
    }
    let url;
    try {
      url = new URL(linkBruto);
    } catch (e) {
      return enviar(res, 400, false, 'O link informado não é uma URL válida.');
    }
    const hostsPermitidos = ['chat.whatsapp.com', 'wa.me', 'api.whatsapp.com'];
    if (url.protocol !== 'https:' || hostsPermitidos.indexOf(url.hostname) === -1) {
      return enviar(res, 400, false, 'Use um link https do WhatsApp (chat.whatsapp.com, wa.me ou api.whatsapp.com).');
    }

    const listaEmails = emailsBruto
      .split(',')
      .map(function (e) { return limparEmail(e); })
      .filter(function (e) { return e.length > 0; });
    if (listaEmails.length > 10 || listaEmails.some(function (e) { return !emailValido(e); })) {
      return enviar(res, 400, false, 'Informe até 10 e-mails válidos separados por vírgula.');
    }

    try {
      const agora = new Date().toISOString();
      const { error } = await supabase.from(TABELA_CONFIG).upsert([
        { chave: 'link_whatsapp', valor: url.toString(), atualizado_em: agora },
        { chave: 'emails_notificacao', valor: listaEmails.join(','), atualizado_em: agora }
      ], { onConflict: 'chave' });
      if (error) throw error;

      log('INFO', '[API] Configurações atualizadas por ' + req.user.email);
      return enviar(res, 200, true, 'Configurações salvas com sucesso.');
    } catch (err) {
      log('ERRO', '[API] /salvar-config: ' + err.message);
      return enviar(res, 500, false, 'Erro de conexão com a nuvem. Tente novamente em instantes.');
    }
  }
]);

// -----------------------------------------------------------------------------
// 8. ROTAS NÃO MAPEADAS (404) E ERROS GLOBAIS
// -----------------------------------------------------------------------------
app.use(function (req, res) {
  return enviar(res, 404, false, 'Rota não encontrada: ' + req.method + ' ' + req.path);
});

// eslint-disable-next-line no-unused-vars
app.use(function (err, req, res, next) {
  if (err && err.type === 'entity.parse.failed') {
    return enviar(res, 400, false, 'JSON inválido no corpo da requisição.');
  }
  if (err && err.type === 'entity.too.large') {
    return enviar(res, 413, false, 'Corpo da requisição grande demais.');
  }
  log('ERRO', 'Erro não tratado em ' + req.method + ' ' + req.path + ': ' + (err && err.message));
  return enviar(res, 500, false, 'Erro interno do servidor. Tente novamente em instantes.');
});

// -----------------------------------------------------------------------------
// 9. INICIALIZAÇÃO, VALIDAÇÃO DE VARIÁVEIS E ENCERRAMENTO GRACIOSO
// -----------------------------------------------------------------------------
if (!process.env.SUPABASE_URL) log('WARN', 'SUPABASE_URL não definida. Usando valor de desenvolvimento.');
if (!process.env.SUPABASE_KEY) log('WARN', 'SUPABASE_KEY não definida. Usando chave pública (as escritas no banco serão bloqueadas pelo RLS).');
if (/^sb_publishable_|^eyJ.*anon/.test(SUPABASE_KEY) && process.env.SUPABASE_KEY) {
  log('WARN', 'SUPABASE_KEY parece ser uma chave pública. Em produção use a chave service_role.');
}
if (!process.env.MP_ACCESS_TOKEN) log('WARN', 'MP_ACCESS_TOKEN não definida. /criar-pagamento retornará erro até configurar.');
if (!process.env.ADMIN_EMAILS) log('WARN', 'ADMIN_EMAILS não definida. Usando apenas: ' + ADMIN_EMAILS.join(', ') + '. Adicione o e-mail da Nicolly.');
if (!PUBLIC_URL) log('WARN', 'PUBLIC_URL não definida. O webhook do Mercado Pago ficará desativado (a verificação manual continua funcionando).');

process.on('uncaughtException', function (err) {
  log('ERRO', 'uncaughtException: ' + (err && err.stack ? err.stack : err));
});
process.on('unhandledRejection', function (motivo) {
  log('ERRO', 'unhandledRejection: ' + (motivo && motivo.stack ? motivo.stack : motivo));
});

const servidor = app.listen(PORT, function () {
  log('INFO', 'VIP da Nicolly rodando na porta ' + PORT);
});

function encerrar(sinal) {
  log('INFO', 'Sinal ' + sinal + ' recebido. Encerrando conexões...');
  servidor.close(function () {
    log('INFO', 'Servidor encerrado com segurança.');
    process.exit(0);
  });
  setTimeout(function () { process.exit(1); }, 10000).unref();
}
process.on('SIGTERM', function () { encerrar('SIGTERM'); });
process.on('SIGINT', function () { encerrar('SIGINT'); });
