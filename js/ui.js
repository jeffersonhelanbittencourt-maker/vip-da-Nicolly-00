import { MODAIS } from './config.js';
import { state, $ } from './state.js';

export function mostrarToast(texto, tipo) {
  const container = $('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast' + (tipo === 'erro' ? ' toast-erro' : tipo === 'aviso' ? ' toast-aviso' : '');
  el.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  el.textContent = texto;
  container.appendChild(el);
  window.setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 4500);
}

export function mostrarMsg(el, texto, tipo) {
  if (!el) return;
  el.textContent = texto;
  el.classList.remove('msg-ok', 'msg-erro', 'msg-aviso');
  el.classList.add('msg', 'msg-' + (tipo || 'aviso'));
  el.hidden = false;
}

export function limparMsg(el) {
  if (!el) return;
  el.hidden = true;
  el.textContent = '';
}

export function setCarregando(btn, ligado, textoCarregando) {
  if (!btn) return;
  if (ligado) {
    if (btn.dataset.textoOriginal === undefined) btn.dataset.textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = textoCarregando || 'Aguarde...';
  } else {
    btn.disabled = false;
    if (btn.dataset.textoOriginal !== undefined) {
      btn.textContent = btn.dataset.textoOriginal;
      delete btn.dataset.textoOriginal;
    }
  }
}

export function marcarErroCampo(input) {
  if (!input) return;
  input.classList.add('campo-erro');
  window.setTimeout(() => input.classList.remove('campo-erro'), 2500);
}

export function atualizarTravaScroll() {
  const aberto = MODAIS.some(id => {
    const m = $(id);
    return m && !m.hidden && getComputedStyle(m).display !== 'none';
  });
  document.body.classList.toggle('modal-aberto', aberto);
}

export function abrirModal(id) {
  const m = $(id);
  if (!m) return;
  state.ultimoFoco = document.activeElement;
  m.hidden = false;
  atualizarTravaScroll();
}

export function fecharModal(id) {
  const m = $(id);
  if (!m) return;
  m.hidden = true;
  atualizarTravaScroll();
  if (state.ultimoFoco && typeof state.ultimoFoco.focus === 'function' && document.contains(state.ultimoFoco)) {
    try { state.ultimoFoco.focus(); } catch (e) {}
  }
}

export function pedirConfirmacao(texto) {
  return new Promise(resolve => {
    $('confirmTexto').textContent = texto;
    state.confirmarResolver = resolve;
    abrirModal('modalConfirmar');
    $('btnConfirmarSim').focus();
  });
}

export function resolverConfirmacao(valor) {
  if (state.confirmarResolver) {
    const r = state.confirmarResolver;
    state.confirmarResolver = null;
    r(valor);
  }
}

export function ligarTravasDeConteudo() {
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('dragstart', e => e.preventDefault());
  document.addEventListener('copy', e => {
    const alvo = e.target;
    if (alvo instanceof Element && alvo.closest('input, textarea')) return;
    e.preventDefault();
  });
  window.addEventListener('keydown', e => {
    const tecla = (e.key || '').toLowerCase();
    const comando = e.ctrlKey || e.metaKey;
    let proibido = false;
    if (e.key === 'PrintScreen' || e.key === 'F12') proibido = true;
    if (comando && !e.shiftKey && ['p', 's', 'u'].includes(tecla)) proibido = true;
    if (comando && e.shiftKey && ['i', 'j', 'c'].includes(tecla)) proibido = true;
    if (proibido) {
      e.preventDefault();
      e.stopPropagation();
      abrirModal('modalAviso');
    }
  }, true);
}
