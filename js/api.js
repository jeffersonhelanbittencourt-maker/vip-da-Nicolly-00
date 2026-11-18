import { CONFIG, TEXTOS } from './config.js';
import { state, $ } from './state.js';

export function ApiError(mensagem, status, code, rede) {
  this.name = 'ApiError';
  this.message = mensagem;
  this.status = status || 0;
  this.code = code || '';
  this.rede = !!rede;
  this.tratado = false;
}
ApiError.prototype = Object.create(Error.prototype);
ApiError.prototype.constructor = ApiError;

async function fetchComTimeout(url, opcoes, limiteMs) {
  const controlador = new AbortController();
  const timer = window.setTimeout(() => controlador.abort(), limiteMs);
  try {
    return await fetch(url, { ...opcoes, signal: controlador.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export async function obterToken() {
  if (!state.sb) return '';
  try {
    const resultado = await state.sb.auth.getSession();
    const sessao = resultado?.data?.session;
    return sessao ? sessao.access_token : '';
  } catch (e) {
    return '';
  }
}

export async function api(caminho, opcoes = {}) {
  const headers = { 'Accept': 'application/json' };
  const init = { method: opcoes.method || 'GET', headers };

  if (opcoes.auth !== false) {
    const token = await obterToken();
    if (!token) {
      throw new ApiError(TEXTOS.SESSAO_EXPIRADA, 401, 'SESSAO_EXPIRADA', false);
    }
    headers['Authorization'] = 'Bearer ' + token;
  }
  if (opcoes.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opcoes.body);
  }

  let resposta;
  try {
    resposta = await fetchComTimeout(CONFIG.API_BASE + caminho, init, CONFIG.TIMEOUT_MS);
  } catch (err) {
    const e = new ApiError(TEXTOS.ERRO_SERVIDOR, 0, 'REDE', true);
    e.tratado = true;
    throw e;
  }

  const tipo = resposta.headers.get('content-type') || '';
  if (!tipo.includes('application/json')) {
    throw new ApiError(`Resposta inválida do servidor (status ${resposta.status}).`, resposta.status, 'RESPOSTA_INVALIDA', false);
  }

  const json = await resposta.json().catch(() => {
    throw new ApiError('Resposta inválida do servidor.', resposta.status, 'RESPOSTA_INVALIDA', false);
  });

  if (!resposta.ok || json.success === false) {
    throw new ApiError(json.message || TEXTOS.ERRO_NUVEM, resposta.status, json.code || '', false);
  }
  return json;
}

export async function servidorAcessivel() {
  try {
    const r = await fetchComTimeout(CONFIG.API_BASE + '/health', { method: 'GET' }, CONFIG.HEALTH_TIMEOUT_MS);
    return r.ok;
  } catch (e) {
    return false;
  }
}
