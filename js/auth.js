import { CONFIG, KEYS, TEXTOS, TELAS } from './config.js';
import { state, $ } from './state.js';
import { api, ApiError } from './api.js';
import { mostrarToast, mostrarMsg, limparMsg, setCarregando, marcarErroCampo, abrirModal, fecharModal } from './ui.js';

export function iniciarSupabase() {
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[VIP] SDK do Supabase não carregou.');
    return false;
  }
  state.sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return true;
}

export function validarCredenciais(email, senha, exigirSenha) {
  const campos = [];
  let erro = '';
  const emailOk = email.length > 0 && email.includes('@') && email.lastIndexOf('.') > email.indexOf('@') + 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    erro = 'Informe um e-mail válido.';
    campos.push($('inputEmailAuth'));
  }
  if (exigirSenha && senha.length < 6) {
    erro = erro || 'A senha precisa ter no mínimo 6 caracteres.';
    campos.push($('inputSenhaAuth'));
  }
  return { ok: erro === '', erro, campos };
}

export function traduzirErroAuth(err) {
  const msg = String(err?.message || '').toLowerCase();
  if (msg.includes('failed to fetch') || msg.includes('network')) return TEXTOS.ERRO_NUVEM;
  if (msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('already registered')) return 'Este e-mail já possui conta. Use a aba Entrar.';
  return TEXTOS.ERRO_NUVEM;
}

export function definirModoAuth(modo) {
  state.modoAuth = modo;
  const login = modo === 'login';
  $('tabLogin').setAttribute('aria-selected', String(login));
  $('tabCadastro').setAttribute('aria-selected', String(!login));
  $('btnSubmitAuth').textContent = login ? 'Entrar' : 'Criar conta';
  $('inputSenhaAuth').setAttribute('autocomplete', login ? 'current-password' : 'new-password');
  $('btnEsqueciSenha').hidden = !login;
  limparMsg($('authMsg'));
}

export function abrirAuth(modo, aviso) {
  abrirModal('modalAuth');
  definirModoAuth(modo);
  if (aviso) mostrarMsg($('authMsg'), aviso, 'aviso');
  window.setTimeout(() => $('inputEmailAuth').focus(), 50);
}

export async function enviarAuth(ev) {
  ev.preventDefault();
  if (state.ocupadoAuth || !state.sb) return;
  const email = $('inputEmailAuth').value.trim();
  const senha = $('inputSenhaAuth').value.trim();
  const v = validarCredenciais(email, senha, true);
  if (!v.ok) {
    v.campos.forEach(marcarErroCampo);
    mostrarMsg($('authMsg'), v.erro, 'erro');
    return;
  }
  const btn = $('btnSubmitAuth');
  state.ocupadoAuth = true;
  setCarregando(btn, true, state.modoAuth === 'login' ? 'Aguarde...' : 'Processando...');
  limparMsg($('authMsg'));
  try {
    if (state.modoAuth === 'login') {
      const r = await state.sb.auth.signInWithPassword({ email, password: senha });
      if (r.error) throw r.error;
      fecharModal('modalAuth');
      mostrarToast('Login realizado com sucesso.', 'ok');
    } else {
      const r = await state.sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
      if (r.error) throw r.error;
      fecharModal('modalAuth');
      mostrarToast('Conta criada com sucesso.', 'ok');
    }
  } catch (err) {
    mostrarMsg($('authMsg'), traduzirErroAuth(err), 'erro');
  } finally {
    state.ocupadoAuth = false;
    setCarregando(btn, false);
  }
}

export async function sair() {
  try { if (state.sb) await state.sb.auth.signOut(); } catch (e) {}
  aoSair(true);
}

export function aoSair(avisar) {
  state.session = null;
  state.userId = null;
  state.isAdmin = false;
  state.planoPendente = null;
  try { localStorage.removeItem(KEYS.CLIENTE); } catch (e) {}
  MODAIS.forEach(id => { if (id !== 'modalIdade' && $(id) && !$(id).hidden) fecharModal(id); });
  atualizarNav();
  mostrarTela('telaHome');
  if (avisar) mostrarToast('Você saiu da sua conta.', 'ok');
}

export async function aoEntrar(session) {
  state.session = session;
  state.userId = session.user.id;
  state.isAdmin = false;
  try {
    const r = await api('/papel');
    state.isAdmin = !!r.data?.admin;
  } catch (e) {}
  atualizarNav();
  if (state.isAdmin) mostrarTela('telaAdmin');
  else mostrarTela('telaCliente');
}

export function atualizarNav() {
  const logado = !!state.session;
  $('btnNavEntrar').hidden = logado;
  $('btnNavSair').hidden = !logado;
  $('btnNavArea').hidden = !logado;
  $('btnNavArea').textContent = state.isAdmin ? 'Painel' : 'Minha área';
}

export function mostrarTela(nome) {
  let destino = nome;
  if (destino === 'telaAdmin' && !state.isAdmin) destino = state.session ? 'telaCliente' : 'telaHome';
  if (destino === 'telaCliente' && !state.session) destino = 'telaHome';
  TELAS.forEach(id => { const el = $(id); if (el) el.hidden = id !== destino; });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
