-- =============================================================================
-- VIP DA NICOLLY - database/schema.sql (Versão Monumental & Hiper-Blindada)
-- Rode inteiro no SQL Editor do Supabase.
-- Idempotente: seguro para reexecuções sem perda de dados existentes.
-- =============================================================================

-- 0. Função utilitária global para atualização automática de timestamps
create or replace function public.atualizar_timestamp() returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

-- 1. Catálogo Dinâmico de Planos de Assinatura
create table if not exists public.planos_vip (
  slug          text primary key,
  nome          text not null,
  descricao     text,
  valor         numeric(10,2) not null check (valor > 0),
  dias_duracao  integer, -- null indica plano vitalício/ilimitado
  destaque      boolean not null default false,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

insert into public.planos_vip (slug, nome, descricao, valor, dias_duracao, destaque)
values
  ('semanal',   'Plano Semanal',   'Acesso total por 7 dias',      25.00, 7,    false),
  ('mensal',    'Plano Mensal',    'Acesso total por 30 dias',     50.00, 30,   true),
  ('vitalicio', 'Plano Vitalício', 'Acesso ilimitado para sempre', 200.00, null, false)
on conflict (slug) do nothing;

-- 2. Sistema de Afiliados
create table if not exists public.afiliados_vip (
  codigo     text primary key check (codigo = lower(codigo)),
  nome       text not null,
  email      text not null,
  chave_pix  text not null,
  percentual numeric(5,2) not null check (percentual between 1 and 50),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

-- 3. Clientes e Assinantes VIP
create table if not exists public.clientes_vip (
  id                      uuid primary key default gen_random_uuid(),
  email                   text not null unique,
  nome                    text,
  telefone                text,
  plano                   text,
  status                  text not null default 'pendente',
  payment_id              text,
  valor_pago              numeric(10,2) not null default 0 check (valor_pago >= 0),
  expira_em               timestamptz,
  afiliado                text references public.afiliados_vip(codigo),
  ip_pagador              text,
  ultimo_acesso           timestamptz,
  aviso_expiracao_enviado boolean not null default false,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);

alter table public.clientes_vip add column if not exists nome text;
alter table public.clientes_vip add column if not exists telefone text;
alter table public.clientes_vip add column if not exists valor_pago numeric(10,2) not null default 0;
alter table public.clientes_vip add column if not exists afiliado text references public.afiliados_vip(codigo);
alter table public.clientes_vip add column if not exists ip_pagador text;
alter table public.clientes_vip add column if not exists ultimo_acesso timestamptz;
alter table public.clientes_vip add column if not exists aviso_expiracao_enviado boolean not null default false;

alter table public.clientes_vip drop constraint if exists clientes_vip_status_check;
alter table public.clientes_vip
  add constraint clientes_vip_status_check
  check (status in ('pendente','aprovado','suspend','suspenso','reembolsado'));

create index if not exists clientes_vip_payment_idx on public.clientes_vip (payment_id);
create index if not exists clientes_vip_expira_idx  on public.clientes_vip (expira_em);
create index if not exists clientes_vip_status_idx  on public.clientes_vip (status);

drop trigger if exists clientes_vip_atualizado_trg on public.clientes_vip;
create trigger clientes_vip_atualizado_trg
  before update on public.clientes_vip
  for each row execute function public.atualizar_timestamp();

-- 4. Histórico Completo de Pagamentos
create table if not exists public.pagamentos_vip (
  id               bigserial primary key,
  payment_id       text not null unique,
  preference_id    text,
  email            text not null references public.clientes_vip(email) on update cascade,
  plano            text not null,
  valor            numeric(10,2) not null check (valor > 0),
  metodo_pagamento text default 'mercadopago_checkout',
  cupom            text,
  afiliado         text,
  status           text not null default 'pendente'
                   check (status in ('pendente','aprovado','reembolsado','cancelado')),
  ip_pagador       text,
  lembrete_enviado boolean not null default false,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

alter table public.pagamentos_vip add column if not exists preference_id text;
alter table public.pagamentos_vip add column if not exists metodo_pagamento text default 'mercadopago_checkout';

create index if not exists pagamentos_vip_email_idx  on public.pagamentos_vip (email);
create index if not exists pagamentos_vip_status_idx on public.pagamentos_vip (status, criado_em);

drop trigger if exists pagamentos_vip_atualizado_trg on public.pagamentos_vip;
create trigger pagamentos_vip_atualizado_trg
  before update on public.pagamentos_vip
  for each row execute function public.atualizar_timestamp();

-- 5. Gestão de Cupons de Desconto Avançada
create table if not exists public.cupons_vip (
  codigo     text primary key check (codigo = upper(codigo)),
  percentual integer not null check (percentual between 1 and 90),
  limite_uso integer,
  usos       integer not null default 0,
  ativo      boolean not null default true,
  expira_em  timestamptz,
  criado_em  timestamptz not null default now()
);

insert into public.cupons_vip (codigo, percentual, limite_uso)
values ('BEMVINDO15', 15, 100)
on conflict (codigo) do nothing;

-- 6. Comissões de Afiliados Rastreadas
create table if not exists public.comissoes_vip (
  id         bigserial primary key,
  afiliado   text not null references public.afiliados_vip(codigo),
  payment_id text not null unique,
  email      text not null,
  valor      numeric(10,2) not null check (valor > 0),
  status     text not null default 'pendente' check (status in ('pendente','paga','cancelada')),
  criado_em  timestamptz not null default now()
);
create index if not exists comissoes_vip_afiliado_idx on public.comissoes_vip (afiliado, status);

-- 7. Configurações Globais do Sistema
create table if not exists public.configuracoes (
  chave         text primary key,
  valor         text,
  descricao     text,
  atualizado_em timestamptz not null default now()
);

alter table public.configuracoes add column if not exists descricao text;

insert into public.configuracoes (chave, valor, descricao)
values
  ('link_grupo_vip', '', 'Link oficial de convite para o grupo VIP exclusivo'),
  ('modo_manutencao', 'false', 'Ativa ou desativa aviso de manutenção geral no site'),
  ('suporte_whatsapp', '', 'Contato oficial de suporte ao assinante via WhatsApp')
on conflict (chave) do nothing;

-- 8. Avisos Globais, Banners e Comunicados
create table if not exists public.avisos_globais (
  id        bigserial primary key,
  titulo    text not null,
  texto     text not null,
  nivel     text not null default 'info' check (nivel in ('info','promo','urgente')),
  publico   text not null default 'todos' check (publico in ('todos','vip')),
  link      text,
  inicio    timestamptz not null default now(),
  fim       timestamptz,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists avisos_globais_data_idx on public.avisos_globais (criado_em desc);

-- 9. Equipe Administrativa (Admin Chefe garantido com segurança master)
create table if not exists public.admins_vip (
  email     text primary key,
  nome      text,
  nivel     text not null default 'moderador' check (nivel in ('master','moderador')),
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into public.admins_vip (email, nome, nivel, ativo)
values ('jeffersonhelanbittencourt@gmail.com', 'Jefferson (Admin Chefe)', 'master', true)
on conflict (email) do update set nivel = 'master', ativo = true;

-- 10. Log de Acessos e Rastreamento de Sessões Administrativas
create table if not exists public.acessos_log (
  id          bigserial primary key,
  email       text not null,
  ip          text,
  dispositivo text,
  sucesso     boolean not null default true,
  criado_em   timestamptz not null default now()
);
create index if not exists acessos_log_email_idx on public.acessos_log (email, criado_em desc);

-- 11. Auditoria do Sistema (Imutável por Triggers de Bloqueio)
create table if not exists public.auditoria_sistema (
  id        bigserial primary key,
  evento    text not null,
  ator      text,
  alvo      text,
  ip        text,
  detalhes  jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists auditoria_sistema_data_idx on public.auditoria_sistema (criado_em desc);

create or replace function public.auditoria_imutavel() returns trigger as $$
begin
  raise exception 'A tabela auditoria_sistema é estritamente imutável.';
end;
$$ language plpgsql;

drop trigger if exists auditoria_imutavel_trg on public.auditoria_sistema;
create trigger auditoria_imutavel_trg
  before update or delete on public.auditoria_sistema
  for each row execute function public.auditoria_imutavel();

-- 12. Views Analíticas Avançadas para o Painel Administrativo
create or replace view public.vw_resumo_financeiro as
select
  count(*) filter (where status = 'aprovado') as total_aprovados,
  count(*) filter (where status = 'pendente') as total_pendentes,
  coalesce(sum(valor) filter (where status = 'aprovado'), 0) as faturamento_total,
  coalesce(sum(valor) filter (where status = 'aprovado' and criado_em >= date_trunc('month', now())), 0) as faturamento_mes_atual
from public.pagamentos_vip;

create or replace view public.vw_clientes_ativos as
select
  count(*) as total_ativos
from public.clientes_vip
where status = 'aprovado' and (expira_em is null or expira_em > now());

-- 13. Ativação Rigorosa de RLS (Row Level Security) sem Políticas Públicas
alter table public.planos_vip        enable row level security;
alter table public.afiliados_vip     enable row level security;
alter table public.clientes_vip      enable row level security;
alter table public.pagamentos_vip    enable row level security;
alter table public.cupons_vip        enable row level security;
alter table public.comissoes_vip     enable row level security;
alter table public.configuracoes     enable row level security;
alter table public.avisos_globais    enable row level security;
alter table public.admins_vip        enable row level security;
alter table public.acessos_log       enable row level security;
alter table public.auditoria_sistema enable row level security;
