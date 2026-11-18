export const state = {
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

export function $(id) {
  return document.getElementById(id);
}
