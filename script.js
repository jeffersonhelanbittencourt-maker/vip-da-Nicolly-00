/* =============================================================================
 * VIP DA NICOLLY - script.js (client-side)
 * Seções: 1 CONFIGURAÇÃO | 2 UTILITÁRIOS DE UI | 3 SEGURANÇA E ANTI-PRINT |
 *         4 REDE (API) | 5 AUTENTICAÇÃO | 6 NAVEGAÇÃO | 7 ÁREA DO CLIENTE |
 *         8 CHECKOUT PIX | 9 PAINEL ADMIN | 10 INICIALIZAÇÃO
 * Todo o código fica dentro de uma função isolada (sem poluir o escopo global).
 * ========================================================================== */
(function () {
  'use strict';

  // ===========================================================================
  // 1. CONFIGURAÇÃO
  // ===========================================================================
  const CONFIG = {
    SUPABASE_URL: 'https://wodlhlwezckslounvmlx.supabase.co',
    SUPABASE_KEY: 'sb_publishable_gTnYby203YRRUb0DeNqcKg_Nqe0M9Yr',
    API_BASE: String(window.VIP_API_BASE || '').replace(/\/+$/, ''),
    TIMEOUT_MS: 20000,
    HEALTH_TIMEOUT_MS: 6000,
    POLL_MS: 5000
  };

  const KEYS = {
    IDADE: 'vip_maioridade',
    CLIENTE: 'vip_cliente_ativo'
  };

  const TEXTOS = {
    ERRO_NUVEM: 'Erro de conexão com a nuvem. Tente novamente em instantes.',
    ERRO_SERVIDOR: 'Erro de conexão com o servidor. Verifique sua internet.',
    SESSAO_EXPIRADA: 'Sua sessão expirou. Entre novamente para continuar.'
  };

  const NOMES_PLANOS = {
    semanal: 'Plano Semanal (7 dias) - R$ 25,00',
    mensal: 'Plano Mensal (30 dias) - R$ 50,00',
    vitalicio: 'Plano Vitalício (permanente) - R$ 200,00'
  };

  const PRECOS = { semanal: 25, mensal: 50, vitalicio: 200 };

  const MODAIS = ['modalIdade', 'modalAuth', 'modalSenha', 'modalPix', 'modalConfirmar', 'modalAviso'];
  const TELAS = ['telaHome', 'telaCliente', 'telaAdmin'];

  const state = {
    sb: null,
    session: null,
    userId: null,
    isAdmin: false,
    modoAuth: 'login',
    planoPendente: null,
    ocupadoAuth: false,
    ocupadoSenha: false,
    ocupadoCheckout: false,
    ocupadoGrupo: false,
    pollTimer: null,
    pollOcupado: false,
    copiarTimer: null,
    confirmarResolver: null,
    ultimoFoco: null,
    ultimoErroGlobal: 0,
    checkoutPlano: null,
    cupomAplicado: null,
    clientesAdmin: [],
    buscaAdmin: '',
    filtroStatus: '',
    pagina: 1,
    buscaTimer: null
  };

  /** Atalho para document.getElementById. */
  function $(id) {
    return document.getElementById(id);
  }

  // ===========================================================================
  // 2. UTILITÁRIOS DE UI (toasts, mensagens, loading, modais)
  // ===========================================================================

  /**
   * Exibe um toast animado no topo da tela.
   * @param {string} texto Mensagem (inserida como texto, nunca como HTML).
   * @param {string} [tipo] 'ok' | 'erro' | 'aviso'.
   */
  function mostrarToast(texto, tipo) {
    const container = $('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast' + (tipo === 'erro' ? ' toast-erro' : tipo === 'aviso' ? ' toast-aviso' : '');
    el.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
    el.textContent = texto;
    container.appendChild(el);
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 4500);
  }

  /**
   * Mostra uma caixa de mensagem colorida dentro de um card/modal.
   * @param {HTMLElement} el Elemento da mensagem.
   * @param {string} texto Texto a exibir.
   * @param {string} tipo 'ok' (verde) | 'erro' (vermelho) | 'aviso' (âmbar).
   */
  function mostrarMsg(el, texto, tipo) {
    if (!el) return;
    el.textContent = texto;
    el.classList.remove('msg-ok', 'msg-erro', 'msg-aviso');
    el.classList.add('msg', 'msg-' + (tipo || 'aviso'));
    el.hidden = false;
  }

  /** Esconde e limpa uma caixa de mensagem. */
  function limparMsg(el) {
    if (!el) return;
    el.hidden = true;
    el.textContent = '';
  }

  /**
   * Alterna o estado de carregamento de um botão (texto + disabled).
   * @param {HTMLButtonElement} btn Botão.
   * @param {boolean} ligado true para carregando.
   * @param {string} [textoCarregando] Texto exibido durante o carregamento.
   */
  function setCarregando(btn, ligado, textoCarregando) {
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

  /** Destaca campos inválidos com borda vermelha por 2,5 segundos. */
  function marcarErroCampo(input) {
    if (!input) return;
    input.classList.add('campo-erro');
    window.setTimeout(function () { input.classList.remove('campo-erro'); }, 2500);
  }

  /** Atualiza a trava de rolagem do body conforme haja modais abertos. */
  function atualizarTravaScroll() {
    const aberto = MODAIS.some(function (id) {
      const m = $(id);
      return m && !m.hidden && getComputedStyle(m).display !== 'none';
    });
    document.body.classList.toggle('modal-aberto', aberto);
  }

  /**
   * Abre um modal e guarda o foco anterior.
   * @param {string} id ID do modal.
   */
  function abrirModal(id) {
    const m = $(id);
    if (!m) return;
    state.ultimoFoco = document.activeElement;
    m.hidden = false;
    atualizarTravaScroll();
  }

  /**
   * Fecha um modal, limpa seus campos/estados e devolve o foco.
   * @param {string} id ID do modal.
   */
  function fecharModal(id) {
    const m = $(id);
    if (!m) return;
    m.hidden = true;
    limparModal(id);
    atualizarTravaScroll();
    if (state.ultimoFoco && typeof state.ultimoFoco.focus === 'function' && document.contains(state.ultimoFoco)) {
      try { state.ultimoFoco.focus(); } catch (e) { /* sem ação */ }
    }
  }

  /** Reseta inputs, mensagens e estados residuais de um modal. */
  function limparModal(id) {
    const m = $(id);
    if (!m) return;

    if (id === 'modalPix') {
      pararPolling();
      $('pixEscolha').hidden = true;
      $('pixCarregando').hidden = true;
      $('pixConteudo').hidden = true;
      $('inputPixCupom').value = '';
      $('pixPrecoOriginal').hidden = true;
      state.cupomAplicado = null;
      state.checkoutPlano = null;
      setCarregando($('btnAplicarCupom'), false);
      $('imgPixQr').removeAttribute('src');
      $('inputPixCopiaCola').value = '';
      $('pixPlanoResumo').textContent = '';
      limparMsg($('pixMsg'));
      restaurarBotaoCopiar();
      setCarregando($('btnVerificarPix'), false);
      return;
    }

    if (id === 'modalConfirmar') {
      resolverConfirmacao(false);
      return;
    }

    Array.prototype.forEach.call(m.querySelectorAll('input'), function (inp) {
      inp.value = '';
      inp.classList.remove('campo-erro');
    });
    Array.prototype.forEach.call(m.querySelectorAll('.msg'), function (msg) {
      limparMsg(msg);
    });
  }

  /** Fecha o modal clicando em um botão com data-fechar ou no fundo escuro. */
  function ligarFechamentoDeModais() {
    document.addEventListener('click', function (e) {
      const alvo = e.target;
      if (!(alvo instanceof Element)) return;

      const botao = alvo.closest('[data-fechar]');
      if (botao) {
        fecharModal(botao.getAttribute('data-fechar'));
        return;
      }
      // Clique na área neutra ao redor do card (exceto o modal 18+, que exige resposta)
      if (alvo.classList.contains('modal') && alvo.id !== 'modalIdade') {
        fecharModal(alvo.id);
      }
    });
  }

  /**
   * Pede confirmação ao administrador antes de uma ação crítica.
   * @param {string} texto Pergunta exibida.
   * @returns {Promise<boolean>}
   */
  function pedirConfirmacao(texto) {
    return new Promise(function (resolve) {
      resolverConfirmacao(false);
      $('confirmTexto').textContent = texto;
      state.confirmarResolver = resolve;
      abrirModal('modalConfirmar');
      $('btnConfirmarSim').focus();
    });
  }

  /** Resolve a promessa de confirmação pendente (se houver). */
  function resolverConfirmacao(valor) {
    if (state.confirmarResolver) {
      const r = state.confirmarResolver;
      state.confirmarResolver = null;
      r(valor);
    }
  }

  // ===========================================================================
  // 3. SEGURANÇA E ANTI-PRINT
  // (Barreiras visuais: dissuadem o usuário comum, mas não impedem capturas
  //  feitas por outros meios. A proteção real do link VIP está no servidor.)
  // ===========================================================================

  /** Exibe o modal restritivo informando que a ação é proibida. */
  function mostrarAvisoProibido() {
    abrirModal('modalAviso');
  }

  /**
   * Intercepta atalhos proibidos: PrintScreen, Ctrl+P, Ctrl+S, Ctrl+U,
   * Ctrl+Shift+I (e J/C) e F12.
   * @param {KeyboardEvent} e Evento de teclado.
   */
  function tratarTeclaProibida(e) {
    const tecla = (e.key || '').toLowerCase();
    const comando = e.ctrlKey || e.metaKey;
    let proibido = false;

    if (e.key === 'PrintScreen' || e.key === 'F12') proibido = true;
    if (comando && !e.shiftKey && (tecla === 'p' || tecla === 's' || tecla === 'u')) proibido = true;
    if (comando && e.shiftKey && (tecla === 'i' || tecla === 'j' || tecla === 'c')) proibido = true;

    if (proibido) {
      e.preventDefault();
      e.stopPropagation();
      mostrarAvisoProibido();
    }
  }

  /** Ao soltar PrintScreen, tenta limpar a área de transferência. */
  function tratarSoltarTecla(e) {
    if (e.key === 'PrintScreen') {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('').catch(function () { /* sem permissão */ });
        }
      } catch (err) { /* sem ação */ }
      mostrarAvisoProibido();
    }
  }

  /** Bloqueia menu de contexto, cópia e arrastar fora de campos de texto. */
  function ligarTravasDeConteudo() {
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('dragstart', function (e) { e.preventDefault(); });
    document.addEventListener('copy', function (e) {
      const alvo = e.target;
      if (alvo instanceof Element && alvo.closest('input, textarea')) return;
      e.preventDefault();
    });
  }

  // ===========================================================================
  // 4. REDE (API do servidor Node.js)
  // ===========================================================================

  /** Erro com status HTTP e código vindos do servidor. */
  function ApiError(mensagem, status, code, rede) {
    this.name = 'ApiError';
    this.message = mensagem;
    this.status = status || 0;
    this.code = code || '';
    this.rede = !!rede;
    this.tratado = false;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  /**
   * fetch com timeout (AbortController).
   * @param {string} url URL completa.
   * @param {object} opcoes Opções do fetch.
   * @param {number} limiteMs Tempo máximo de espera.
   * @returns {Promise<Response>}
   */
  async function fetchComTimeout(url, opcoes, limiteMs) {
    const controlador = new AbortController();
    const timer = window.setTimeout(function () { controlador.abort(); }, limiteMs);
    try {
      const init = Object.assign({}, opcoes, { signal: controlador.signal });
      return await fetch(url, init);
    } finally {
      window.clearTimeout(timer);
    }
  }

  /**
   * Chama o back-end. Envia o token do Supabase, valida o Content-Type JSON,
   * trata timeout/queda de rede e sessão expirada.
   * @param {string} caminho Ex.: '/criar-pagamento'.
   * @param {object} [opcoes] { method, body, auth (padrão true) }.
   * @returns {Promise<object>} JSON { success, message, data }.
   */
  async function api(caminho, opcoes) {
    const o = opcoes || {};
    const headers = { 'Accept': 'application/json' };
    const init = { method: o.method || 'GET', headers: headers };

    if (o.auth !== false) {
      const token = await obterToken();
      if (!token) {
        tratarSessaoExpirada();
        throw new ApiError(TEXTOS.SESSAO_EXPIRADA, 401, 'SESSAO_EXPIRADA', false);
      }
      headers['Authorization'] = 'Bearer ' + token;
    }
    if (o.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(o.body);
    }

    let resposta;
    try {
      resposta = await fetchComTimeout(CONFIG.API_BASE + caminho, init, CONFIG.TIMEOUT_MS);
    } catch (err) {
      mostrarToast(TEXTOS.ERRO_SERVIDOR, 'erro');
      const e = new ApiError(TEXTOS.ERRO_SERVIDOR, 0, 'REDE', true);
      e.tratado = true;
      throw e;
    }

    const tipo = resposta.headers.get('content-type') || '';
    if (tipo.indexOf('application/json') === -1) {
      throw new ApiError('Resposta inválida do servidor (status ' + resposta.status + ').', resposta.status, 'RESPOSTA_INVALIDA', false);
    }

    let json;
    try {
      json = await resposta.json();
    } catch (err) {
      throw new ApiError('Resposta inválida do servidor.', resposta.status, 'RESPOSTA_INVALIDA', false);
    }

    if (!resposta.ok || json.success === false) {
      if (resposta.status === 401 && json.code === 'SESSAO_EXPIRADA') {
        tratarSessaoExpirada();
      }
      throw new ApiError(json.message || TEXTOS.ERRO_NUVEM, resposta.status, json.code || '', false);
    }
    return json;
  }

  /** Obtém o token de acesso da sessão atual do Supabase. */
  async function obterToken() {
    if (!state.sb) return '';
    try {
      const resultado = await state.sb.auth.getSession();
      const sessao = resultado && resultado.data && resultado.data.session;
      return sessao ? sessao.access_token : '';
    } catch (e) {
      return '';
    }
  }

  /** Verifica rapidamente se o servidor está acessível (/health). */
  async function servidorAcessivel() {
    try {
      const r = await fetchComTimeout(CONFIG.API_BASE + '/health', { method: 'GET' }, CONFIG.HEALTH_TIMEOUT_MS);
      return r.ok;
    } catch (e) {
      return false;
    }
  }

  // ===========================================================================
  // 5. AUTENTICAÇÃO (Supabase Auth)
  // ===========================================================================

  /** Cria o cliente Supabase, verificando se o SDK e as credenciais existem. */
  function iniciarSupabase() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      console.error('[VIP] SDK do Supabase não carregou (window.supabase indefinido). Verifique a CDN.');
      return false;
    }
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY) {
      console.error('[VIP] Credenciais do Supabase ausentes na configuração.');
      return false;
    }
    state.sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return true;
  }

  /**
   * Valida e-mail (contém "@" e ".") e senha (mínimo 6 caracteres).
   * @param {string} email E-mail já com trim.
   * @param {string} senha Senha já com trim.
   * @param {boolean} exigirSenha Se false, valida só o e-mail.
   * @returns {{ok:boolean, erro:string, campos:HTMLElement[]}}
   */
  function validarCredenciais(email, senha, exigirSenha) {
    const campos = [];
    let erro = '';
    const emailOk = email.length > 0 && email.indexOf('@') > 0 && email.lastIndexOf('.') > email.indexOf('@') + 1 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!emailOk) {
      erro = 'Informe um e-mail válido (exemplo: nome@dominio.com).';
      campos.push($('inputEmailAuth'));
    }
    if (exigirSenha && senha.length < 6) {
      erro = erro || 'A senha precisa ter no mínimo 6 caracteres.';
      campos.push($('inputSenhaAuth'));
    }
    return { ok: erro === '', erro: erro, campos: campos };
  }

  /**
   * Traduz erros do Supabase Auth para mensagens claras em português.
   * @param {object} err Erro retornado pelo Supabase.
   * @returns {string}
   */
  function traduzirErroAuth(err) {
    const msg = String((err && err.message) || '').toLowerCase();
    const codigo = String((err && err.code) || '').toLowerCase();

    if (msg.indexOf('failed to fetch') !== -1 || msg.indexOf('network') !== -1 || msg.indexOf('fetch') !== -1) return TEXTOS.ERRO_NUVEM;
    if (msg.indexOf('invalid login credentials') !== -1) return 'E-mail ou senha incorretos.';
    if (msg.indexOf('email not confirmed') !== -1) return 'Confirme seu e-mail pelo link enviado antes de entrar.';
    if (msg.indexOf('already registered') !== -1 || codigo === 'user_already_exists') return 'Este e-mail já possui conta. Use a aba Entrar.';
    if (msg.indexOf('password should be at least') !== -1 || codigo === 'weak_password') return 'A senha precisa ter no mínimo 6 caracteres.';
    if (msg.indexOf('invalid email') !== -1 || codigo === 'email_address_invalid') return 'E-mail inválido. Confira e tente novamente.';
    if (msg.indexOf('user not found') !== -1) return 'Nenhuma conta encontrada com este e-mail.';
    if (msg.indexOf('rate limit') !== -1 || codigo.indexOf('rate_limit') !== -1 || msg.indexOf('too many') !== -1) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
    if (msg.indexOf('same password') !== -1 || codigo === 'same_password') return 'A nova senha precisa ser diferente da atual.';
    return TEXTOS.ERRO_NUVEM;
  }

  /** Alterna entre as abas Entrar / Criar conta. */
  function definirModoAuth(modo) {
    state.modoAuth = modo;
    const login = modo === 'login';
    $('tabLogin').setAttribute('aria-selected', String(login));
    $('tabCadastro').setAttribute('aria-selected', String(!login));
    $('btnSubmitAuth').textContent = login ? 'Entrar' : 'Criar conta';
    $('inputSenhaAuth').setAttribute('autocomplete', login ? 'current-password' : 'new-password');
    $('btnEsqueciSenha').hidden = !login;
    limparMsg($('authMsg'));
  }

  /**
   * Abre o modal de login/cadastro com foco no e-mail.
   * @param {string} modo 'login' | 'cadastro'.
   * @param {string} [aviso] Mensagem âmbar opcional.
   */
  function abrirAuth(modo, aviso) {
    abrirModal('modalAuth');
    definirModoAuth(modo);
    if (aviso) mostrarMsg($('authMsg'), aviso, 'aviso');
    window.setTimeout(function () { $('inputEmailAuth').focus(); }, 50);
  }

  /** Submit do formulário de login/cadastro. */
  async function enviarAuth(ev) {
    ev.preventDefault();
    if (state.ocupadoAuth) return;
    if (!state.sb) {
      mostrarMsg($('authMsg'), TEXTOS.ERRO_NUVEM, 'erro');
      return;
    }

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
        const r = await state.sb.auth.signInWithPassword({ email: email, password: senha });
        if (r.error) throw r.error;
        fecharModal('modalAuth');
        mostrarToast('Login realizado com sucesso.', 'ok');
      } else {
        const r = await state.sb.auth.signUp({
          email: email,
          password: senha,
          options: { emailRedirectTo: window.location.origin + window.location.pathname }
        });
        if (r.error) throw r.error;

        const usuario = r.data && r.data.user;
        if (usuario && Array.isArray(usuario.identities) && usuario.identities.length === 0) {
          definirModoAuth('login');
          mostrarMsg($('authMsg'), 'Este e-mail já possui conta. Entre com sua senha.', 'aviso');
          $('inputEmailAuth').value = email;
          return;
        }
        if (r.data && r.data.session) {
          fecharModal('modalAuth');
          mostrarToast('Conta criada com sucesso.', 'ok');
        } else {
          mostrarMsg($('authMsg'), 'Conta criada. Enviamos um link de confirmação para o seu e-mail. Confirme e depois entre.', 'ok');
        }
      }
    } catch (err) {
      console.error('[VIP] Falha na autenticação:', err);
      mostrarMsg($('authMsg'), traduzirErroAuth(err), 'erro');
    } finally {
      state.ocupadoAuth = false;
      setCarregando(btn, false);
    }
  }

  /** Envia o e-mail de recuperação de senha. */
  async function recuperarSenha() {
    if (!state.sb) return;
    const email = $('inputEmailAuth').value.trim();
    const v = validarCredenciais(email, '', false);
    if (!v.ok) {
      v.campos.forEach(marcarErroCampo);
      mostrarMsg($('authMsg'), 'Digite seu e-mail acima para receber o link de recuperação.', 'erro');
      return;
    }
    const btn = $('btnEsqueciSenha');
    setCarregando(btn, true, 'Aguarde...');
    try {
      const r = await state.sb.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
      });
      if (r.error) throw r.error;
      mostrarMsg($('authMsg'), 'Se este e-mail estiver cadastrado, você receberá o link de recuperação.', 'ok');
    } catch (err) {
      console.error('[VIP] Falha ao recuperar senha:', err);
      mostrarMsg($('authMsg'), traduzirErroAuth(err), 'erro');
    } finally {
      setCarregando(btn, false);
    }
  }

  /** Submit do formulário de troca de senha. */
  async function enviarNovaSenha(ev) {
    ev.preventDefault();
    if (state.ocupadoSenha || !state.sb) return;
    const nova = $('inputNovaSenha').value.trim();
    if (nova.length < 6) {
      marcarErroCampo($('inputNovaSenha'));
      mostrarMsg($('senhaMsg'), 'A senha precisa ter no mínimo 6 caracteres.', 'erro');
      return;
    }
    const btn = $('btnSalvarSenha');
    state.ocupadoSenha = true;
    setCarregando(btn, true, 'Salvando...');
    try {
      const r = await state.sb.auth.updateUser({ password: nova });
      if (r.error) throw r.error;
      fecharModal('modalSenha');
      mostrarToast('Senha alterada com sucesso.', 'ok');
    } catch (err) {
      console.error('[VIP] Falha ao trocar senha:', err);
      mostrarMsg($('senhaMsg'), traduzirErroAuth(err), 'erro');
    } finally {
      state.ocupadoSenha = false;
      setCarregando(btn, false);
    }
  }

  /** Encerra a sessão pelo método oficial do Supabase e limpa o estado local. */
  async function sair() {
    try {
      if (state.sb) await state.sb.auth.signOut();
    } catch (err) {
      console.error('[VIP] Falha ao encerrar sessão no Supabase:', err);
    }
    aoSair(true);
  }

  /** Limpeza cirúrgica do localStorage (mantém só a confirmação de maioridade). */
  function limparArmazenamentoLocal() {
    try {
      localStorage.removeItem(KEYS.CLIENTE);
      const remover = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && k.indexOf('sb-') === 0) remover.push(k);
      }
      remover.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { /* localStorage indisponível */ }
  }

  /**
   * Reseta todo o estado do usuário e volta para a Home.
   * @param {boolean} avisar Exibe toast de saída.
   */
  function aoSair(avisar) {
    pararPolling();
    state.session = null;
    state.userId = null;
    state.isAdmin = false;
    state.planoPendente = null;
    limparArmazenamentoLocal();
    MODAIS.forEach(function (id) {
      if (id !== 'modalIdade' && $(id) && !$(id).hidden) fecharModal(id);
    });
    atualizarNav();
    mostrarTela('telaHome');
    if (avisar) mostrarToast('Você saiu da sua conta.', 'ok');
  }

  /** Sessão/token expirado durante o uso: volta para a Home com explicação. */
  function tratarSessaoExpirada() {
    if (!state.userId && !state.session) return;
    if (state.sb) {
      state.sb.auth.signOut().catch(function () { /* sem ação */ });
    }
    aoSair(false);
    mostrarToast(TEXTOS.SESSAO_EXPIRADA, 'aviso');
  }

  /**
   * Chamado quando há uma sessão válida: descobre o papel no servidor
   * (checagem dupla do admin) e direciona para a tela correta.
   * @param {object} session Sessão do Supabase.
   */
  async function aoEntrar(session) {
    state.session = session;
    state.userId = session.user.id;
    state.isAdmin = false;

    try {
      const r = await api('/papel');
      state.isAdmin = !!(r.data && r.data.admin);
    } catch (err) {
      console.error('[VIP] Não foi possível confirmar o papel do usuário:', err);
      if (!state.session) return;
    }
    atualizarNav();

    if (state.planoPendente) {
      const plano = state.planoPendente;
      state.planoPendente = null;
      mostrarTela('telaHome');
      iniciarCheckout(plano);
      return;
    }
    if (state.isAdmin) {
      mostrarTela('telaAdmin');
    } else {
      mostrarTela('telaCliente');
    }
  }

  /** Reage aos eventos do Supabase Auth. */
  function ligarEventosAuth() {
    if (!state.sb) return;
    state.sb.auth.onAuthStateChange(function (evento, session) {
      // setTimeout evita travar o SDK ao chamar outras funções dentro do callback
      window.setTimeout(function () {
        if (evento === 'PASSWORD_RECOVERY') {
          abrirModal('modalSenha');
          return;
        }
        if (evento === 'SIGNED_OUT') {
          if (state.userId) aoSair(false);
          return;
        }
        if (session && session.user) {
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

  /** Sincroniza sessão entre abas do navegador. */
  function ligarSincronizacaoEntreAbas() {
    window.addEventListener('storage', function (e) {
      if (!e.key) return;
      const relevante = e.key === KEYS.CLIENTE || e.key.indexOf('sb-') === 0;
      if (!relevante || !state.sb) return;

      state.sb.auth.getSession().then(function (r) {
        const sessao = r && r.data && r.data.session;
        if (!sessao && state.userId) {
          aoSair(false);
        } else if (sessao && state.userId !== sessao.user.id) {
          aoEntrar(sessao);
        }
      }).catch(function (err) {
        console.error('[VIP] Falha ao sincronizar abas:', err);
      });
    });
  }

  // ===========================================================================
  // 6. NAVEGAÇÃO ENTRE TELAS
  // ===========================================================================

  /**
   * Exibe uma única tela e oculta as demais. Telas restritas só abrem com
   * sessão (cliente) ou papel de administrador confirmado pelo servidor.
   * @param {string} nome 'telaHome' | 'telaCliente' | 'telaAdmin'.
   */
  function mostrarTela(nome) {
    let destino = nome;
    if (destino === 'telaAdmin' && !state.isAdmin) destino = state.session ? 'telaCliente' : 'telaHome';
    if (destino === 'telaCliente' && !state.session) destino = 'telaHome';

    TELAS.forEach(function (id) {
      const el = $(id);
      if (el) el.hidden = id !== destino;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (destino === 'telaCliente') atualizarAreaCliente();
    if (destino === 'telaAdmin') {
      carregarClientes();
      carregarConfig();
    }
  }

  /** Atualiza a visibilidade dos botões do menu conforme a sessão. */
  function atualizarNav() {
    const logado = !!state.session;
    $('btnNavEntrar').hidden = logado;
    $('btnNavSair').hidden = !logado;
    $('btnNavArea').hidden = !logado;
    $('btnNavArea').textContent = state.isAdmin ? 'Painel' : 'Minha área';
  }

  // ===========================================================================
  // 7. ÁREA DO CLIENTE
  // ===========================================================================

  /** Formata data ISO em dd/mm/aaaa (ou traço quando vazia). */
  function formatarData(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('pt-BR');
  }

  /** Atualiza o selo de status (cor e texto). */
  function pintarSelo(el, status, expirado) {
    el.className = 'selo selo-' + (status === 'aprovado' ? 'aprovado' : status === 'suspenso' ? 'suspenso' : 'pendente');
    el.textContent = status === 'aprovado' ? 'Aprovado' : status === 'suspenso' ? 'Suspenso' : (expirado ? 'Expirado' : 'Pendente');
  }

  /**
   * Desenha a Área do Cliente a partir de um objeto de cliente.
   * O botão do Grupo VIP só aparece com status aprovado.
   * @param {object} c Cliente normalizado pelo servidor.
   */
  function renderizarCliente(c) {
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

  /**
   * Mostra o cache local imediatamente e revalida com o servidor/Supabase.
   * O cache (vip_cliente_ativo) é só um atalho visual de sessão.
   */
  async function atualizarAreaCliente() {
    if (!state.session) return;
    const email = state.session.user.email;

    try {
      const bruto = localStorage.getItem(KEYS.CLIENTE);
      const cache = bruto ? JSON.parse(bruto) : null;
      if (cache && cache.email === email) renderizarCliente(cache);
      else renderizarCliente({ email: email, plano: '', status: 'pendente', expira_em: '', expirado: false });
    } catch (e) {
      renderizarCliente({ email: email, plano: '', status: 'pendente', expira_em: '', expirado: false });
    }

    const btn = $('btnAtualizarStatus');
    setCarregando(btn, true, 'Aguarde...');
    try {
      const r = await api('/verificar-status?email=' + encodeURIComponent(email));
      renderizarCliente(r.data);
      try { localStorage.setItem(KEYS.CLIENTE, JSON.stringify(r.data)); } catch (e) { /* sem ação */ }
    } catch (err) {
      console.error('[VIP] Falha ao atualizar a Área do Cliente:', err);
      if (!err.tratado && err.code !== 'SESSAO_EXPIRADA') mostrarToast(err.message || TEXTOS.ERRO_NUVEM, 'erro');
    } finally {
      setCarregando(btn, false);
    }
  }

  /** Busca o link do grupo no servidor (só responde se aprovado) e redireciona. */
  async function entrarNoGrupo() {
    if (state.ocupadoGrupo) return;
    state.ocupadoGrupo = true;
    const btn = $('btnGrupoVip');
    const span = btn.querySelector('span');
    const original = span.textContent;
    btn.disabled = true;
    span.textContent = 'Aguarde...';

    // Abre a aba antes da requisição para não ser barrada pelo bloqueador de pop-ups
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
      console.error('[VIP] Falha ao obter o link do grupo:', err);
      if (!err.tratado) mostrarToast(err.message || TEXTOS.ERRO_NUVEM, 'erro');
      atualizarAreaCliente();
    } finally {
      state.ocupadoGrupo = false;
      btn.disabled = false;
      span.textContent = original;
    }
  }

  // ===========================================================================
  // 8. CHECKOUT PIX
  // ===========================================================================

  /** Ativa/desativa todos os botões de plano da Home. */
  function travarBotoesPlano(travar) {
    Array.prototype.forEach.call(document.querySelectorAll('.btn-plano'), function (b) {
      b.disabled = travar;
    });
  }

  /** Para o polling de verificação automática do Pix. */
  function pararPolling() {
    if (state.pollTimer) {
      window.clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
    state.pollOcupado = false;
  }

  /** Consulta o status no servidor a cada POLL_MS enquanto o modal estiver aberto. */
  function iniciarPolling() {
    pararPolling();
    state.pollTimer = window.setInterval(function () {
      if (state.pollOcupado) return;
      verificarPagamento(true);
    }, CONFIG.POLL_MS);
  }

  /**
   * Inicia o checkout de um plano: desativa os botões, abre o pop-up de
   * carregamento, checa o servidor e gera o Pix.
   * @param {string} plano 'semanal' | 'mensal' | 'vitalicio'.
   */
  function formatarBRL(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /** Mostra o preço do plano; com cupom, o original riscado e o novo em destaque. */
  function renderizarPrecoPix() {
    const original = PRECOS[state.checkoutPlano] || 0;
    const cupom = state.cupomAplicado;
    $('pixPrecoOriginal').hidden = !cupom;
    $('pixPrecoOriginal').textContent = formatarBRL(original);
    $('pixPrecoFinal').textContent = formatarBRL(cupom ? cupom.valor_final : original);
  }

  /** Valida o cupom no servidor. Se falhar, o cliente segue com o valor integral. */
  async function aplicarCupom() {
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
        mostrarMsg($('pixMsg'), (err.message || TEXTOS.ERRO_NUVEM) + ' Você pode seguir com o valor integral.', 'aviso');
      }
    } finally {
      setCarregando(btn, false);
    }
  }

  /**
   * Passo 1 do checkout: abre o modal com o preço e o campo de cupom.
   * @param {string} plano 'semanal' | 'mensal' | 'vitalicio'.
   */
  function iniciarCheckout(plano) {
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

  /**
   * Passo 2: gera o Pix (com o cupom, se houver), desativando os botões
   * imediatamente para impedir cobranças duplicadas.
   * @param {string} plano Plano escolhido.
   */
  async function gerarPix(plano) {
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
        mostrarToast(TEXTOS.ERRO_SERVIDOR, 'erro');
        falhaNoPix('Não foi possível falar com o servidor. Feche esta janela, verifique sua internet e tente gerar o Pix novamente.');
        return;
      }

      const r = await api('/criar-pagamento', { method: 'POST', body: { plano: plano, cupom: state.cupomAplicado ? state.cupomAplicado.codigo : '' } });
      const dados = r.data || {};
      if (!dados.qr_code || !dados.qr_code_base64) {
        throw new ApiError('Resposta sem QR Code.', 502, '', false);
      }

      $('imgPixQr').src = 'data:image/png;base64,' + dados.qr_code_base64;
      $('inputPixCopiaCola').value = dados.qr_code;
      $('pixCarregando').hidden = true;
      $('pixConteudo').hidden = false;
      mostrarMsg($('pixMsg'), 'Pague no app do seu banco. Assim que o pagamento for aprovado, o acesso é liberado automaticamente.', 'aviso');
      iniciarPolling();
    } catch (err) {
      console.error('[VIP] Falha ao gerar o Pix:', err);
      if (err.code === 'SESSAO_EXPIRADA') {
        fecharModal('modalPix');
      } else if (err.status === 409) {
        $('pixCarregando').hidden = true;
        mostrarMsg($('pixMsg'), err.message, 'ok');
        atualizarAreaCliente();
      } else {
        falhaNoPix(err.status === 403 ? err.message : 'Não foi possível gerar o Pix agora. Feche esta janela e tente gerar a cobrança novamente em instantes.');
      }
    } finally {
      state.ocupadoCheckout = false;
      travarBotoesPlano(false);
    }
  }

  /** Mostra a orientação de falha no lugar do Copia e Cola. */
  function falhaNoPix(texto) {
    $('pixCarregando').hidden = true;
    $('pixConteudo').hidden = false;
    $('imgPixQr').removeAttribute('src');
    $('inputPixCopiaCola').value = '';
    $('inputPixCopiaCola').placeholder = 'Feche e tente gerar o Pix novamente';
    $('btnCopiarPix').disabled = true;
    $('btnVerificarPix').disabled = true;
    mostrarMsg($('pixMsg'), texto, 'erro');
  }

  /** Volta o botão de copiar ao estado normal. */
  function restaurarBotaoCopiar() {
    if (state.copiarTimer) {
      window.clearTimeout(state.copiarTimer);
      state.copiarTimer = null;
    }
    $('txtCopiarPix').textContent = 'Copiar código Pix';
    $('btnCopiarPix').disabled = false;
    $('btnVerificarPix').disabled = false;
    $('inputPixCopiaCola').placeholder = 'O código do Pix aparece aqui';
  }

  /** Copia o Pix Copia e Cola (clipboard moderno com plano B por seleção). */
  async function copiarPix() {
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

    if (!copiado) {
      try {
        input.focus();
        input.select();
        input.setSelectionRange(0, texto.length);
        copiado = document.execCommand('copy');
      } catch (err) {
        copiado = false;
      }
    }

    if (copiado) {
      $('txtCopiarPix').textContent = 'Copiado!';
      if (state.copiarTimer) window.clearTimeout(state.copiarTimer);
      state.copiarTimer = window.setTimeout(function () {
        $('txtCopiarPix').textContent = 'Copiar código Pix';
        state.copiarTimer = null;
      }, 2000);
    } else {
      mostrarMsg($('pixMsg'), 'Não foi possível copiar automaticamente. Toque no código, selecione tudo e copie.', 'aviso');
    }
  }

  /**
   * Consulta /verificar-status. Se aprovado: fecha o Pix, para os timers e
   * leva o cliente à Área do Cliente liberada.
   * @param {boolean} silencioso true quando chamado pelo polling automático.
   */
  async function verificarPagamento(silencioso) {
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
        try { localStorage.setItem(KEYS.CLIENTE, JSON.stringify(c)); } catch (e) { /* sem ação */ }
        fecharModal('modalPix');
        mostrarToast('Parabéns! Pagamento aprovado. Seu acesso foi liberado.', 'ok');
        mostrarTela('telaCliente');
      } else if (!silencioso) {
        mostrarMsg($('pixMsg'), 'Pagamento ainda não identificado. Aguarde alguns segundos após pagar e verifique de novo.', 'aviso');
      }
    } catch (err) {
      console.error('[VIP] Falha ao verificar pagamento:', err);
      if (!silencioso && !err.tratado && err.code !== 'SESSAO_EXPIRADA') {
        mostrarMsg($('pixMsg'), err.message || TEXTOS.ERRO_NUVEM, 'erro');
      }
    } finally {
      state.pollOcupado = false;
      if (!silencioso && !$('modalPix').hidden) setCarregando(btn, false);
    }
  }

  // ===========================================================================
  // 9. PAINEL ADMIN
  // ===========================================================================

  /** Cria uma célula de texto segura (textContent, sem HTML). */
  function criarCelula(texto, classe) {
    const td = document.createElement('td');
    if (classe) td.className = classe;
    td.textContent = texto;
    return td;
  }

  /** Desenha a tabela de clientes (limpa o container antes de inserir). */
  function renderizarTabela(lista, textoVazio) {
    const corpo = $('corpoTabelaAdmin');
    while (corpo.firstChild) corpo.removeChild(corpo.firstChild);

    if (!lista || lista.length === 0) {
      const tr = document.createElement('tr');
      tr.className = 'linha-vazia';
      const td = document.createElement('td');
      td.colSpan = 5;
      td.textContent = textoVazio || 'Nenhum cliente cadastrado até o momento.';
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
      btnAprovar.addEventListener('click', function () { alterarStatus(c.email, 'aprovado', btnAprovar); });

      const btnSuspender = document.createElement('button');
      btnSuspender.type = 'button';
      btnSuspender.className = 'btn btn-ambar btn-pequeno';
      btnSuspender.textContent = 'Suspender';
      btnSuspender.disabled = c.status === 'suspenso';
      btnSuspender.addEventListener('click', function () { alterarStatus(c.email, 'suspenso', btnSuspender); });

      acoes.appendChild(btnAprovar);
      acoes.appendChild(btnSuspender);
      tdAcoes.appendChild(acoes);
      tr.appendChild(tdAcoes);
      corpo.appendChild(tr);
    });
  }

  /** Aplica busca e filtro de status à lista carregada. */
  function filtrarClientes() {
    const termo = state.buscaAdmin.trim().toLowerCase();
    return state.clientesAdmin.filter(function (c) {
      if (state.filtroStatus && c.status !== state.filtroStatus) return false;
      return !termo || String(c.email || '').toLowerCase().indexOf(termo) !== -1;
    });
  }

  /** Filtra, pagina (20 por página) e redesenha a tabela. */
  function aplicarFiltrosAdmin() {
    const POR_PAGINA = 20;
    const lista = filtrarClientes();
    const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    if (state.pagina > paginas) state.pagina = paginas;
    if (state.pagina < 1) state.pagina = 1;
    const inicio = (state.pagina - 1) * POR_PAGINA;

    renderizarTabela(
      lista.slice(inicio, inicio + POR_PAGINA),
      state.clientesAdmin.length > 0 ? 'Nenhum cliente encontrado com esses filtros.' : undefined
    );
    $('txtPaginaAdmin').textContent = 'Página ' + state.pagina + ' de ' + paginas + ' (' + lista.length + ' clientes)';
    $('btnPaginaAnterior').disabled = state.pagina <= 1;
    $('btnPaginaProxima').disabled = state.pagina >= paginas;
  }

  /** Preenche os cards de métricas com dados reais do Supabase. */
  async function carregarMetricas() {
    try {
      const r = await api('/metricas');
      const m = r.data || {};
      $('mAtivos').textContent = String(m.ativos || 0);
      $('mPendentes').textContent = String(m.pendentes || 0);
      $('mConversao').textContent = String(m.conversao || 0).replace('.', ',') + '%';
      $('mFaturamento').textContent = formatarBRL(m.faturamento || 0);
    } catch (err) {
      console.error('[VIP] Falha ao carregar métricas:', err);
    }
  }

  /** Protege a célula de CSV contra injeção de fórmulas (=, +, -, @). */
  function celulaCsv(valor) {
    let texto = String(valor === null || valor === undefined ? '' : valor);
    if (/^[=+\-@\t\r]/.test(texto)) texto = "'" + texto;
    return '"' + texto.replace(/"/g, '""') + '"';
  }

  /** Exporta em CSV (UTF-8 com BOM, separador ;) a lista com os filtros atuais. */
  function exportarCsv() {
    const lista = filtrarClientes();
    if (lista.length === 0) {
      mostrarToast('Não há clientes para exportar com esses filtros.', 'aviso');
      return;
    }
    const linhas = [['email', 'plano', 'status', 'vencimento', 'valor_pago'].map(celulaCsv).join(';')];
    lista.forEach(function (c) {
      linhas.push([c.email, c.plano, c.expirado ? 'expirado' : c.status, c.plano === 'vitalicio' ? 'permanente' : formatarData(c.expira_em), c.valor_pago || 0]
        .map(celulaCsv).join(';'));
    });
    const blob = new Blob(['\uFEFF' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clientes_vip_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    mostrarToast('Exportação concluída.', 'ok');
  }

  /** GET /listar-clientes e redesenha a tabela. */
  async function carregarClientes() {
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
      console.error('[VIP] Falha ao listar clientes:', err);
      if (err.code !== 'SESSAO_EXPIRADA') mostrarMsg($('adminMsg'), err.message || TEXTOS.ERRO_NUVEM, 'erro');
    } finally {
      setCarregando(btn, false);
    }
  }

  /**
   * Aprovar/Suspender com confirmação, indicador "Salvando..." e recarga da tabela.
   * @param {string} email E-mail do cliente.
   * @param {string} status 'aprovado' | 'suspenso'.
   * @param {HTMLButtonElement} btn Botão clicado.
   */
  async function alterarStatus(email, status, btn) {
    const verbo = status === 'aprovado' ? 'APROVAR' : 'SUSPENDER';
    const confirmou = await pedirConfirmacao('Deseja ' + verbo + ' o acesso de ' + email + '?');
    fecharModal('modalConfirmar');
    if (!confirmou) return;

    setCarregando(btn, true, 'Salvando...');
    try {
      await api('/atualizar-status', { method: 'POST', body: { email: email, status: status } });
      mostrarToast('Status de ' + email + ' atualizado para ' + (status === 'aprovado' ? 'aprovado' : 'suspenso') + '.', 'ok');
      await carregarClientes();
    } catch (err) {
      console.error('[VIP] Falha ao atualizar status:', err);
      setCarregando(btn, false);
      if (!err.tratado && err.code !== 'SESSAO_EXPIRADA') mostrarToast(err.message || TEXTOS.ERRO_NUVEM, 'erro');
    }
  }

  /** Carrega o link do WhatsApp e e-mails de notificação nos campos. */
  async function carregarConfig() {
    if (!state.isAdmin) return;
    try {
      const r = await api('/config');
      $('inputLinkWhats').value = (r.data && r.data.link_whatsapp) || '';
      $('inputEmailsNotif').value = (r.data && r.data.emails_notificacao) || '';
    } catch (err) {
      console.error('[VIP] Falha ao carregar configurações:', err);
    }
  }

  /** Salva as configurações editáveis. */
  async function salvarConfig(ev) {
    ev.preventDefault();
    const link = $('inputLinkWhats').value.trim();
    const emails = $('inputEmailsNotif').value.trim();
    const msg = $('configMsg');

    if (!link) {
      marcarErroCampo($('inputLinkWhats'));
      mostrarMsg(msg, 'Informe o link de convite do grupo do WhatsApp.', 'erro');
      return;
    }

    const btn = $('btnSalvarConfig');
    setCarregando(btn, true, 'Salvando...');
    try {
      await api('/salvar-config', { method: 'POST', body: { link_whatsapp: link, emails_notificacao: emails } });
      mostrarMsg(msg, 'Configurações salvas com sucesso.', 'ok');
      mostrarToast('Configurações salvas.', 'ok');
    } catch (err) {
      console.error('[VIP] Falha ao salvar configurações:', err);
      if (err.code !== 'SESSAO_EXPIRADA') mostrarMsg(msg, err.message || TEXTOS.ERRO_NUVEM, 'erro');
    } finally {
      setCarregando(btn, false);
    }
  }

  // ===========================================================================
  // 10. INICIALIZAÇÃO
  // ===========================================================================

  /** Controla o modal de maioridade (18+). */
  function iniciarMaioridade() {
    let confirmada = false;
    try { confirmada = localStorage.getItem(KEYS.IDADE) === 'true'; } catch (e) { confirmada = false; }

    if (confirmada) {
      $('modalIdade').style.display = 'none';
      return;
    }
    atualizarTravaScroll();
    $('btnIdadeSim').focus();
  }

  /** Marca a maioridade como confirmada e libera o site. */
  function confirmarMaioridade() {
    try { localStorage.setItem(KEYS.IDADE, 'true'); } catch (e) { /* sem ação */ }
    document.documentElement.classList.add('maior');
    $('modalIdade').style.display = 'none';
    $('modalIdade').hidden = true;
    atualizarTravaScroll();
  }

  /** Bloqueia o acesso de quem não é maior de idade. */
  function negarMaioridade() {
    $('idadePergunta').hidden = true;
    $('idadeNegado').hidden = false;
    document.body.classList.add('bloqueado');
  }

  /** Mostra aviso se algum script externo (CDN) falhou. */
  function verificarCDNs() {
    const falhou = window.__cdnFalhou || (typeof window.tailwind === 'undefined' ? 'tailwind' : '');
    if (falhou) {
      $('avisoCDN').hidden = false;
      console.warn('[VIP] Recurso externo não carregou:', falhou);
    }
  }

  /** Handlers globais de erro: aviso elegante + detalhe no console. */
  function ligarErrosGlobais() {
    function avisar(detalhe) {
      console.error('[VIP] Erro global não tratado:', detalhe);
      const agora = Date.now();
      if (agora - state.ultimoErroGlobal < 5000) return;
      state.ultimoErroGlobal = agora;
      mostrarToast('Algo deu errado. Tente novamente em instantes.', 'erro');
    }
    window.addEventListener('error', function (e) { avisar(e.error || e.message); });
    window.addEventListener('unhandledrejection', function (e) {
      if (e.reason && e.reason.tratado) return;
      avisar(e.reason);
    });
    window.addEventListener('offline', function () {
      mostrarToast('Sem conexão com a internet. Verifique sua rede.', 'aviso');
    });
  }

  /** Liga todos os eventos da interface (executado uma única vez). */
  function ligarEventosDaInterface() {
    // Maioridade
    $('btnIdadeSim').addEventListener('click', confirmarMaioridade);
    $('btnIdadeNao').addEventListener('click', negarMaioridade);
    $('btnIdadeFechar').addEventListener('click', negarMaioridade);

    // Navegação
    $('btnNavPlanos').addEventListener('click', function () {
      mostrarTela('telaHome');
      window.setTimeout(function () {
        const alvo = $('planos');
        if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    });
    $('linkLogo').addEventListener('click', function (e) { e.preventDefault(); mostrarTela('telaHome'); });
    $('btnNavEntrar').addEventListener('click', function () { abrirAuth('login'); });
    $('btnNavArea').addEventListener('click', function () { mostrarTela(state.isAdmin ? 'telaAdmin' : 'telaCliente'); });
    $('btnNavSair').addEventListener('click', sair);
    $('btnSairCliente').addEventListener('click', sair);
    $('btnSairAdmin').addEventListener('click', sair);

    // Planos
    Array.prototype.forEach.call(document.querySelectorAll('.btn-plano'), function (b) {
      b.addEventListener('click', function () { iniciarCheckout(b.getAttribute('data-plano')); });
    });

    // Autenticação
    $('tabLogin').addEventListener('click', function () { definirModoAuth('login'); });
    $('tabCadastro').addEventListener('click', function () { definirModoAuth('cadastro'); });
    $('formAuth').addEventListener('submit', enviarAuth);
    $('btnEsqueciSenha').addEventListener('click', recuperarSenha);
    $('formSenha').addEventListener('submit', enviarNovaSenha);

    // Área do cliente
    $('btnGrupoVip').addEventListener('click', entrarNoGrupo);
    $('btnVerPlanos').addEventListener('click', function () { $('btnNavPlanos').click(); });
    $('btnAtualizarStatus').addEventListener('click', atualizarAreaCliente);
    $('btnTrocarSenha').addEventListener('click', function () {
      abrirModal('modalSenha');
      window.setTimeout(function () { $('inputNovaSenha').focus(); }, 50);
    });

    // Pix
    $('btnCopiarPix').addEventListener('click', copiarPix);
    $('btnAplicarCupom').addEventListener('click', aplicarCupom);
    $('btnGerarPix').addEventListener('click', function () { gerarPix(state.checkoutPlano); });
    $('btnVerificarPix').addEventListener('click', function () { verificarPagamento(false); });

    // Confirmação do admin
    $('btnConfirmarSim').addEventListener('click', function () { resolverConfirmacao(true); });
    $('btnConfirmarNao').addEventListener('click', function () { resolverConfirmacao(false); fecharModal('modalConfirmar'); });

    // Painel admin
    $('btnAtualizarLista').addEventListener('click', carregarClientes);
    $('btnExportarCsv').addEventListener('click', exportarCsv);
    $('inputBuscaAdmin').addEventListener('input', function (e) {
      window.clearTimeout(state.buscaTimer);
      const valor = e.target.value;
      state.buscaTimer = window.setTimeout(function () {
        state.buscaAdmin = valor;
        state.pagina = 1;
        aplicarFiltrosAdmin();
      }, 200);
    });
    $('selectStatusAdmin').addEventListener('change', function (e) {
      state.filtroStatus = e.target.value;
      state.pagina = 1;
      aplicarFiltrosAdmin();
    });
    $('btnPaginaAnterior').addEventListener('click', function () { state.pagina -= 1; aplicarFiltrosAdmin(); });
    $('btnPaginaProxima').addEventListener('click', function () { state.pagina += 1; aplicarFiltrosAdmin(); });
    $('formConfig').addEventListener('submit', salvarConfig);

    // Tecla ESC fecha o modal aberto (o 18+ não fecha: exige resposta)
    document.addEventListener('keydown', function (e) {
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

    ligarFechamentoDeModais();
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Travas de segurança (anexadas uma única vez)
    window.addEventListener('keydown', tratarTeclaProibida, true);
    window.addEventListener('keyup', tratarSoltarTecla, true);
    ligarTravasDeConteudo();

    ligarErrosGlobais();
    verificarCDNs();
    iniciarMaioridade();
    ligarEventosDaInterface();
    ligarSincronizacaoEntreAbas();

    // Estado inicial: apenas a Home visível
    TELAS.forEach(function (id) { $(id).hidden = id !== 'telaHome'; });
    atualizarNav();

    if (iniciarSupabase()) {
      ligarEventosAuth();
    } else {
      mostrarToast(TEXTOS.ERRO_NUVEM, 'aviso');
    }
  });
})();
