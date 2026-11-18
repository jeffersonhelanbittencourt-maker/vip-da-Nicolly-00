import { KEYS, TELAS } from './config.js';
import { state, $ } from './state.js';
import { api } from './api.js';
import { mostrarToast, abrirModal, fecharModal, ligarTravasDeConteudo, resolverConfirmacao } from './ui.js';
import { iniciarSupabase, abrirAuth, enviarAuth, sair, aoEntrar, aoSair, atualizarNav, mostrarTela } from './auth.js';
import { iniciarCheckout, gerarPix, copiarPix, verificarPagamento, aplicarCupom } from './pix.js';
import { carregarClientes, carregarConfig, salvarConfig, aplicarFiltrosAdmin } from './admin.js';

function iniciarMaioridade() {
  let confirmada = false;
  try { confirmada = localStorage.getItem(KEYS.IDADE) === 'true'; } catch (e) {}
  if (confirmada) {
    $('modalIdade').style.display = 'none';
    return;
  }
}

function confirmarMaioridade() {
  try { localStorage.setItem(KEYS.IDADE, 'true'); } catch (e) {}
  document.documentElement.classList.add('maior');
  $('modalIdade').style.display = 'none';
  $('modalIdade').hidden = true;
}

function negarMaioridade() {
  $('idadePergunta').hidden = true;
  $('idadeNegado').hidden = false;
  document.body.classList.add('bloqueado');
}

function ligarEventosDaInterface() {
  $('btnIdadeSim').addEventListener('click', confirmarMaioridade);
  $('btnIdadeNao').addEventListener('click', negarMaioridade);
  $('btnIdadeFechar').addEventListener('click', negarMaioridade);

  $('btnNavPlanos').addEventListener('click', () => {
    mostrarTela('telaHome');
    window.setTimeout(() => {
      const alvo = $('planos');
      if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  });
  $('linkLogo').addEventListener('click', e => { e.preventDefault(); mostrarTela('telaHome'); });
  $('btnNavEntrar').addEventListener('click', () => abrirAuth('login'));
  $('btnNavArea').addEventListener('click', () => mostrarTela(state.isAdmin ? 'telaAdmin' : 'telaCliente'));
  $('btnNavSair').addEventListener('click', sair);
  $('btnSairCliente').addEventListener('click', sair);
  $('btnSairAdmin').addEventListener('click', sair);

  Array.prototype.forEach.call(document.querySelectorAll('.btn-plano'), b => {
    b.addEventListener('click', () => iniciarCheckout(b.getAttribute('data-plano')));
  });

  $('tabLogin').addEventListener('click', () => definirModoAuth('login'));
  $('tabCadastro').addEventListener('click', () => definirModoAuth('cadastro'));
  $('formAuth').addEventListener('submit', enviarAuth);

  $('btnCopiarPix').addEventListener('click', copiarPix);
  $('btnAplicarCupom').addEventListener('click', aplicarCupom);
  $('btnGerarPix').addEventListener('click', () => gerarPix(state.checkoutPlano));
  $('btnVerificarPix').addEventListener('click', () => verificarPagamento(false));

  $('btnConfirmarSim').addEventListener('click', () => resolverConfirmacao(true));
  $('btnConfirmarNao').addEventListener('click', () => { resolverConfirmacao(false); fecharModal('modalConfirmar'); });

  $('btnAtualizarLista').addEventListener('click', carregarClientes);
  $('inputBuscaAdmin').addEventListener('input', e => {
    window.clearTimeout(state.buscaTimer);
    const valor = e.target.value;
    state.buscaTimer = window.setTimeout(() => {
      state.buscaAdmin = valor;
      state.pagina = 1;
      aplicarFiltrosAdmin();
    }, 200);
  });
  $('selectStatusAdmin').addEventListener('change', e => {
    state.filtroStatus = e.target.value;
    state.pagina = 1;
    aplicarFiltrosAdmin();
  });
  $('btnPaginaAnterior').addEventListener('click', () => { state.pagina -= 1; aplicarFiltrosAdmin(); });
  $('btnPaginaProxima').addEventListener('click', () => { state.pagina += 1; aplicarFiltrosAdmin(); });
  $('formConfig').addEventListener('submit', salvarConfig);

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const ordem = ['modalAviso', 'modalConfirmar', 'modalPix', 'modalSenha', 'modalAuth'];
    for (let i = 0; i < ordem.length; i += 1) {
      const m = $(ordem[i]);
      if (m && !m.hidden) {
        fecharModal(ordem[i]);
        break;
      }
    }
  });

  document.addEventListener('click', e => {
    const alvo = e.target;
    if (!(alvo instanceof Element)) return;
    const botao = alvo.closest('[data-fechar]');
    if (botao) {
      fecharModal(botao.getAttribute('data-fechar'));
      return;
    }
    if (alvo.classList.contains('modal') && alvo.id !== 'modalIdade') {
      fecharModal(alvo.id);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  ligarTravasDeConteudo();
  iniciarMaioridade();
  ligarEventosDaInterface();

  TELAS.forEach(id => { $(id).hidden = id !== 'telaHome'; });
  atualizarNav();

  if (iniciarSupabase()) {
    state.sb.auth.onAuthStateChange((evento, session) => {
      window.setTimeout(() => {
        if (evento === 'SIGNED_OUT') {
          if (state.userId) aoSair(false);
        } else if (session && session.user) {
          if ((evento === 'INITIAL_SESSION' || evento === 'SIGNED_IN') && state.userId !== session.user.id) {
            aoEntrar(session);
          } else {
            state.session = session;
          }
        } else if (evento === 'INITIAL_SESSION') {
          atualizarNav();
          mostrarTela('telaHome');
        }
      }, 0);
    });
  }
});
