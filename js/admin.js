import { NOMES_PLANOS } from './config.js';
import { state, $ } from './state.js';
import { api } from './api.js';
import { mostrarToast, mostrarMsg, limparMsg, setCarregando, pedirConfirmacao, fecharModal } from './ui.js';

export function formatarData(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
}

export function pintarSelo(el, status, expirado) {
  el.className = 'selo selo-' + (status === 'aprovado' ? 'aprovado' : status === 'suspenso' ? 'suspenso' : 'pendente');
  el.textContent = status === 'aprovado' ? 'Aprovado' : status === 'suspenso' ? 'Suspenso' : (expirado ? 'Expirado' : 'Pendente');
}

export function formatarBRL(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function criarCelula(texto, classe) {
  const td = document.createElement('td');
  if (classe) td.className = classe;
  td.textContent = texto;
  return td;
}

export function renderizarTabela(lista) {
  const corpo = $('corpoTabelaAdmin');
  while (corpo.firstChild) corpo.removeChild(corpo.firstChild);

  if (!lista || lista.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'linha-vazia';
    const td = document.createElement('td');
    td.colSpan = 5;
    td.textContent = 'Nenhum cliente encontrado.';
    tr.appendChild(td);
    corpo.appendChild(tr);
    return;
  }

  lista.forEach(function (c) {
    const tr = document.createElement('tr');
    tr.appendChild(criarCelula(c.email || '-', 'celula-email'));
    tr.appendChild(criarCelula(c.plano ? (NOMES_PLANOS[c.plano] || c.plano).split(' - ')[0] : '-'));

    const tdStatus = document.createElement('td');
    const selo = document.createElement('span');
    pintarSelo(selo, c.status, c.expirado);
    tdStatus.appendChild(selo);
    tr.appendChild(tdStatus);

    tr.appendChild(criarCelula(c.plano === 'vitalicio' ? 'Permanente' : formatarData(c.expira_em)));

    const tdAcoes = document.createElement('td');
    const acoes = document.createElement('div');
    acoes.className = 'acoes-linha';

    const btnAprovar = document.createElement('button');
    btnAprovar.type = 'button';
    btnAprovar.className = 'btn btn-verde btn-pequeno';
    btnAprovar.textContent = 'Aprovar';
    btnAprovar.disabled = c.status === 'aprovado';
    btnAprovar.addEventListener('click', () => alterarStatus(c.email, 'aprovado', btnAprovar));

    const btnSuspender = document.createElement('button');
    btnSuspender.type = 'button';
    btnSuspender.className = 'btn btn-ambar btn-pequeno';
    btnSuspender.textContent = 'Suspender';
    btnSuspender.disabled = c.status === 'suspenso';
    btnSuspender.addEventListener('click', () => alterarStatus(c.email, 'suspenso', btnSuspender));

    acoes.appendChild(btnAprovar);
    acoes.appendChild(btnSuspender);
    tdAcoes.appendChild(acoes);
    tr.appendChild(tdAcoes);
    corpo.appendChild(tr);
  });
}

export function filtrarClientes() {
  const termo = state.buscaAdmin.trim().toLowerCase();
  return state.clientesAdmin.filter(function (c) {
    if (state.filtroStatus && c.status !== state.filtroStatus) return false;
    return !termo || String(c.email || '').toLowerCase().includes(termo);
  });
}

export function aplicarFiltrosAdmin() {
  const POR_PAGINA = 20;
  const lista = filtrarClientes();
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  if (state.pagina > paginas) state.pagina = paginas;
  if (state.pagina < 1) state.pagina = 1;
  const inicio = (state.pagina - 1) * POR_PAGINA;

  renderizarTabela(lista.slice(inicio, inicio + POR_PAGINA));
  $('txtPaginaAdmin').textContent = 'Página ' + state.pagina + ' de ' + paginas + ' (' + lista.length + ' clientes)';
  $('btnPaginaAnterior').disabled = state.pagina <= 1;
  $('btnPaginaProxima').disabled = state.pagina >= paginas;
}

export async function carregarMetricas() {
  try {
    const r = await api('/metricas');
    const m = r.data || {};
    $('mAtivos').textContent = String(m.ativos || 0);
    $('mPendentes').textContent = String(m.pendentes || 0);
    $('mConversao').textContent = String(m.conversao || 0).replace('.', ',') + '%';
    $('mFaturamento').textContent = formatarBRL(m.faturamento || 0);
  } catch (e) {}
}

export async function carregarClientes() {
  if (!state.isAdmin) return;
  const btn = $('btnAtualizarLista');
  setCarregando(btn, true, 'Aguarde...');
  limparMsg($('adminMsg'));
  try {
    const r = await api('/listar-clientes');
    state.clientesAdmin = Array.isArray(r.data) ? r.data : [];
    aplicarFiltrosAdmin();
    carregarMetricas();
  } catch (err) {
    if (err.code !== 'SESSAO_EXPIRADA') mostrarMsg($('adminMsg'), err.message || 'Erro ao carregar clientes.', 'erro');
  } finally {
    setCarregando(btn, false);
  }
}

export async function alterarStatus(email, status, btn) {
  const verbo = status === 'aprovado' ? 'APROVAR' : 'SUSPENDER';
  const confirmou = await pedirConfirmacao('Deseja ' + verbo + ' o acesso de ' + email + '?');
  fecharModal('modalConfirmar');
  if (!confirmou) return;

  setCarregando(btn, true, 'Salvando...');
  try {
    await api('/atualizar-status', { method: 'POST', body: { email, status } });
    mostrarToast('Status atualizado com sucesso.', 'ok');
    await carregarClientes();
  } catch (err) {
    setCarregando(btn, false);
    if (!err.tratado && err.code !== 'SESSAO_EXPIRADA') mostrarToast(err.message || 'Erro ao alterar status.', 'erro');
  }
}

export async function carregarConfig() {
  if (!state.isAdmin) return;
  try {
    const r = await api('/config');
    $('inputLinkWhats').value = r.data?.link_whatsapp || '';
    $('inputEmailsNotif').value = r.data?.emails_notificacao || '';
  } catch (e) {}
}

export async function salvarConfig(ev) {
  ev.preventDefault();
  const link = $('inputLinkWhats').value.trim();
  const emails = $('inputEmailsNotif').value.trim();
  const msg = $('configMsg');
  if (!link) {
    mostrarMsg(msg, 'Informe o link do WhatsApp.', 'erro');
    return;
  }
  const btn = $('btnSalvarConfig');
  setCarregando(btn, true, 'Salvando...');
  try {
    await api('/salvar-config', { method: 'POST', body: { link_whatsapp: link, emails_notificacao: emails } });
    mostrarMsg(msg, 'Configurações salvas com sucesso.', 'ok');
    mostrarToast('Configurações salvas.', 'ok');
  } catch (err) {
    if (err.code !== 'SESSAO_EXPIRADA') mostrarMsg(msg, err.message || 'Erro ao salvar.', 'erro');
  } finally {
    setCarregando(btn, false);
  }
}
