-- ============================================================================
-- TechTransfer-Software-DB  |  Grupo 11  |  NASA TechTransfer / Software
-- ============================================================================

-- tabela principal
create table if not exists public.softwares (
  id                 bigint generated always as identity primary key,
  codigo             text not null,        -- chave natural (ex.: GSC-16852-1), vem da API
  id_nasa            text,                 -- id interno da NASA (texto opaco)
  titulo             text,
  descricao          text,                 -- limpa: sem tags HTML, sem destaque de busca
  categoria          text,                 -- ex.: Data and Image Processing
  centro             text,                 -- sigla em letras maiúsculas (ex.: JPL, GSFC, LARC)
  centro_nome        text,
  licenca            text,                 -- tipo de release (Open Source, U.S. Release Only...)
  notas_acesso       text,                 -- texto livre da NASA sobre como obter o software
  urls               text[] not null default '{}',   -- repositório / download
  url_detalhe        text generated always as ('https://software.nasa.gov/software/' || codigo) stored,
  raw                jsonb,                -- linha original da API (sem o score da busca)
  ativo              boolean not null default true,
  primeira_vez_visto timestamptz not null default now(),
  ultima_vez_visto   timestamptz not null default now(),
  busca              tsvector generated always as (
                       to_tsvector('english', coalesce(titulo, '') || ' ' || coalesce(descricao, ''))
                     ) stored,
  -- UNIQUE na chave natural: permite upsert (on_conflict=codigo) sem duplicatas
  constraint softwares_codigo_key unique (codigo)
);

create index if not exists softwares_categoria_idx on public.softwares (categoria) where ativo;
create index if not exists softwares_centro_idx    on public.softwares (centro)    where ativo;
create index if not exists softwares_licenca_idx   on public.softwares (licenca)   where ativo;
create index if not exists softwares_visto_idx     on public.softwares (ultima_vez_visto);
create index if not exists softwares_busca_idx     on public.softwares using gin (busca);

-- log do pipeline
create table if not exists public.execucoes (
  id                    bigint generated always as identity primary key,
  iniciada_em           timestamptz not null,
  finalizada_em         timestamptz not null default now(),
  status                text not null check (status in ('concluido', 'erro_parcial', 'erro_critico')),
  registros_processados integer not null default 0,   -- itens únicos enviados ao banco
  registros_novos       integer not null default 0,
  registros_inativados  integer not null default 0,
  lotes                 integer not null default 0,
  erros                 integer not null default 0,
  termos_executados     integer not null default 0,
  mensagem              text,
  detalhes              jsonb                          -- resultado de cada termo de busca
);

create index if not exists execucoes_finalizada_idx on public.execucoes (finalizada_em desc);

-- RLS 
alter table public.softwares enable row level security;
alter table public.execucoes enable row level security;

drop policy if exists softwares_leitura_publica on public.softwares;
create policy softwares_leitura_publica on public.softwares
  for select to anon, authenticated using (true);

drop policy if exists execucoes_leitura_publica on public.execucoes;
create policy execucoes_leitura_publica on public.execucoes
  for select to anon, authenticated using (true);

--  GRANTs explícitos
grant select on public.softwares, public.execucoes to anon, authenticated;
grant all on public.softwares, public.execucoes to service_role;
grant usage, select on all sequences in schema public to service_role;
