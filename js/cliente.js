import { KEYS, NOMES_PLANOS, TEXTOS } from './config.js';
import { state, $ } from './state.js';
import { api, ApiError } from './api.js';
import { mostrarToast, mostrarMsg, limparMsg, setCarregando } from './ui.js';
import { formatarData, pintarSelo } from './admin.js';

export function renderizarCliente(c) {
  $('clienteEmail').textContent = c.email || (state.session ? state.session.user.email : '');
  $('clientePlano').textContent = c.plano ? (NOMES_PLANOS[c.plano] || c.plano) : 'Nenhum plano escolhido';
  pintarSelo($('clienteStatus'), c.status, c.expirado);

  const aprovado = c.status === 'aprovado';
  $('btnGrupoVip').disabled = !aprovado;
  $('iconeCadeado').hidden = aprovado;
  $('iconeSeta').hidden = !aprovado;
  $('txtGrupoVip').textContent = aprovado ? 'Entrar no Grupo VIP' : 'Grupo VIP bloqueado até o pagamento';
  $('blocoVencimento').hidden = !(aprovado && c.expira_em);
  $('clienteVencimento').textContent = formatarData(c.expira_em);

  const msg = $('clienteMsg');
  if (aprovado) {
    limparMsg(msg);
  } else if (c.status === 'suspenso') {
    mostrarMsg(msg, 'Seu acesso está suspenso. Fale com o suporte.', 'erro');
  } else if (c.expirado) {
    mostrarMsg(msg, 'Seu plano expirou. Escolha um plano para renovar.', 'aviso');
  } else if (c.plano) {
    mostrarMsg(msg, 'Pagamento pendente. Se já pagou, toque em "Atualizar status".', 'aviso');
  } else {
    mostrarMsg(msg, 'Você ainda não tem um plano. Toque em "Ver planos" para começar.', 'aviso');
  }
}

export async function atualizarAreaCliente() {
  if (!state.session) return;
  const email = state.session.user.email;

  try {
    const bruto = localStorage.getItem(KEYS.CLIENTE);
    const cache = bruto ? JSON.parse(bruto) : null;
    if (cache && cache.email === email) renderizarCliente(cache);
    else renderizarCliente({ email, plano: '', status: 'pendente', expira_em: '', expirado: false });
  } catch (e) {
    renderizarCliente({ email, plano: '', status: 'pendente', expira_em: '', expirado: false });
  }

  const btn = $('btnAtualizarStatus');
  setCarregando(btn, true, 'Aguarde...');
  try {
    const r = await api('/verificar-status?email=' + encodeURIComponent(email));
    renderizarCliente(r.data);
    try { localStorage.setItem(KEYS.CLIENTE, JSON.stringify(r.data)); } catch (e) {}
  } catch (err) {
    if (!err.tratado && err.code !== 'SESSAO_EXPIRADA') mostrarToast(err.message || TEXTOS.ERRO_NUVEM, 'erro');
  } finally {
    setCarregando(btn, false);
  }
}

export async function entrarNoGrupo() {
  if (state.ocupadoGrupo) return;
  state.ocupadoGrupo = true;
  const btn = $('btnGrupoVip');
  const span = btn.querySelector('span');
  const original = span.textContent;
  btn.disabled = true;
  span.textContent = 'Aguarde...';

  const aba = window.open('about:blank', '_blank');
  try {
    const r = await api('/link-vip');
    const link = r.data && r.data.link;
    if (!link) throw new ApiError('Link indisponível.', 404, '', false);
    if (aba) {
      aba.opener = null;
      aba.location.href = link;
    } else {
      window.location.href = link;
    }
  } catch (err) {
    if (aba) aba.close();
    if (!err.tratado) mostrarToast(err.message || TEXTOS.ERRO_NUVEM, 'erro');
    atualizarAreaCliente();
  } finally {
    state.ocupadoGrupo = false;
    btn.disabled = false;
    span.textContent = original;
  }
}
