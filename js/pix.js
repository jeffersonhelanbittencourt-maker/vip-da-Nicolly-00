import { NOMES_PLANOS, PRECOS } from './config.js';
import { state, $ } from './state.js';
import { api, ApiError, servidorAcessivel } from './api.js';
import { mostrarToast, mostrarMsg, limparMsg, setCarregando, marcarErroCampo, abrirModal, fecharModal } from './ui.js';
import { abrirAuth } from './auth.js';
import { atualizarAreaCliente } from './cliente.js'; // Conectado com o próximo módulo se necessário

export function travarBotoesPlano(travar) {
  Array.prototype.forEach.call(document.querySelectorAll('.btn-plano'), function (b) {
    b.disabled = travar;
  });
}

export function pararPolling() {
  if (state.pollTimer) {
    window.clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
  state.pollOcupado = false;
}

export function iniciarPolling() {
  pararPolling();
  state.pollTimer = window.setInterval(function () {
    if (state.pollOcupado) return;
    verificarPagamento(true);
  }, 5000);
}

export function formatarBRL(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function renderizarPrecoPix() {
  const original = PRECOS[state.checkoutPlano] || 0;
  const cupom = state.cupomAplicado;
  $('pixPrecoOriginal').hidden = !cupom;
  $('pixPrecoOriginal').textContent = formatarBRL(original);
  $('pixPrecoFinal').textContent = formatarBRL(cupom ? cupom.valor_final : original);
}

export async function aplicarCupom() {
  const input = $('inputPixCupom');
  const codigo = input.value.trim().toUpperCase();
  const btn = $('btnAplicarCupom');
  if (!codigo) {
    marcarErroCampo(input);
    mostrarMsg($('pixMsg'), 'Digite o código do cupom.', 'erro');
    return;
  }
  setCarregando(btn, true, 'Aguarde...');
  limparMsg($('pixMsg'));
  try {
    const r = await api('/validar-cupom', { method: 'POST', body: { plano: state.checkoutPlano, cupom: codigo } });
    state.cupomAplicado = { codigo: r.data.codigo, percentual: r.data.percentual, valor_final: r.data.valor_final };
    renderizarPrecoPix();
    mostrarMsg($('pixMsg'), 'Cupom aplicado: ' + r.data.percentual + '% de desconto.', 'ok');
  } catch (err) {
    state.cupomAplicado = null;
    renderizarPrecoPix();
    if (!err.tratado && err.code !== 'SESSAO_EXPIRADA') {
      mostrarMsg($('pixMsg'), (err.message || 'Erro ao validar cupom.') + ' Você pode seguir com o valor integral.', 'aviso');
    }
  } finally {
    setCarregando(btn, false);
  }
}

export function iniciarCheckout(plano) {
  if (state.ocupadoCheckout) return;

  if (!state.session) {
    state.planoPendente = plano;
    abrirAuth('cadastro', 'Crie sua conta ou entre para gerar o Pix do plano escolhido.');
    return;
  }

  state.checkoutPlano = plano;
  state.cupomAplicado = null;
  abrirModal('modalPix');
  $('pixConteudo').hidden = true;
  $('pixCarregando').hidden = true;
  limparMsg($('pixMsg'));
  $('pixPlanoResumo').textContent = NOMES_PLANOS[plano] || '';
  $('inputPixCupom').value = '';
  renderizarPrecoPix();
  $('pixEscolha').hidden = false;
}

export async function gerarPix(plano) {
  if (state.ocupadoCheckout || !plano) return;
  state.ocupadoCheckout = true;
  travarBotoesPlano(true);
  abrirModal('modalPix');
  $('pixEscolha').hidden = true;
  $('pixCarregando').hidden = false;
  $('pixConteudo').hidden = true;
  limparMsg($('pixMsg'));
  $('pixPlanoResumo').textContent = NOMES_PLANOS[plano] || '';

  try {
    const acessivel = await servidorAcessivel();
    if (!acessivel) {
      falhaNoPix('Servidor indisponível no momento. Tente novamente.');
      return;
    }

    const r = await api('/criar-pagamento', {
      method: 'POST',
      body: { plano: plano, cupom: state.cupomAplicado ? state.cupomAplicado.codigo : '' }
    });
    const dados = r.data || {};
    if (!dados.qr_code || !dados.qr_code_base64) {
      throw new ApiError('Resposta sem QR Code.', 502, '', false);
    }

    $('imgPixQr').src = 'data:image/png;base64,' + dados.qr_code_base64;
    $('inputPixCopiaCola').value = dados.qr_code;
    $('pixCarregando').hidden = true;
    $('pixConteudo').hidden = false;
    mostrarMsg($('pixMsg'), 'Pague no app do seu banco. O acesso libera automaticamente após a aprovação.', 'aviso');
    iniciarPolling();
  } catch (err) {
    if (err.code === 'SESSAO_EXPIRADA') {
      fecharModal('modalPix');
    } else {
      falhaNoPix(err.message || 'Não foi possível gerar o Pix.');
    }
  } finally {
    state.ocupadoCheckout = false;
    travarBotoesPlano(false);
  }
}

export function falhaNoPix(texto) {
  $('pixCarregando').hidden = true;
  $('pixConteudo').hidden = false;
  $('imgPixQr').removeAttribute('src');
  $('inputPixCopiaCola').value = '';
  $('btnCopiarPix').disabled = true;
  $('btnVerificarPix').disabled = true;
  mostrarMsg($('pixMsg'), texto, 'erro');
}

export async function copiarPix() {
  const input = $('inputPixCopiaCola');
  const texto = input.value;
  if (!texto) return;

  let copiado = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      copiado = true;
    }
  } catch (err) {
    copiado = false;
  }

  if (copiado) {
    $('txtCopiarPix').textContent = 'Copiado!';
    if (state.copiarTimer) window.clearTimeout(state.copiarTimer);
    state.copiarTimer = window.setTimeout(function () {
      $('txtCopiarPix').textContent = 'Copiar código Pix';
      state.copiarTimer = null;
    }, 2000);
  } else {
    mostrarMsg($('pixMsg'), 'Toque no código e copie manualmente.', 'aviso');
  }
}

export async function verificarPagamento(silencioso) {
  if (!state.session) return;
  const btn = $('btnVerificarPix');
  if (!silencioso) setCarregando(btn, true, 'Aguarde...');
  state.pollOcupado = true;

  try {
    const email = state.session.user.email;
    const r = await api('/verificar-status?email=' + encodeURIComponent(email));
    const c = r.data;
    if (c && c.status === 'aprovado') {
      pararPolling();
      try { localStorage.setItem('vip_cliente_ativo', JSON.stringify(c)); } catch (e) {}
      fecharModal('modalPix');
      mostrarToast('Pagamento aprovado! Acesso liberado.', 'ok');
      window.location.reload();
    } else if (!silencioso) {
      mostrarMsg($('pixMsg'), 'Pagamento ainda não identificado. Aguarde alguns segundos.', 'aviso');
    }
  } catch (err) {
    if (!silencioso && !err.tratado && err.code !== 'SESSAO_EXPIRADA') {
      mostrarMsg($('pixMsg'), err.message || 'Erro ao verificar pagamento.', 'erro');
    }
  } finally {
    state.pollOcupado = false;
    if (!silencioso && !$('modalPix').hidden) setCarregando(btn, false);
  }
}
