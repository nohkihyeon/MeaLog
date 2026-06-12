-- MeaLog 동기화 스키마
--
-- 설정 순서:
--   1. https://supabase.com 에서 새 프로젝트 생성 (Free 플랜)
--   2. SQL Editor에 이 파일 전체를 붙여넣고 Run
--   3. Authentication → Users → "Add user"로 본인 계정 1개 생성 (email + password)
--      ※ "Auto Confirm User" 체크
--   4. Project Settings → API에서 URL과 anon public 키를 복사해
--      프로젝트 루트의 .env 파일에 입력 (.env.example 참고)
--   5. 앱 사이드바 하단 "동기화 로그인"으로 로그인하면 끝
--
-- 주의: Free 플랜은 1주일간 요청이 없으면 프로젝트가 일시정지됨 (대시보드에서 클릭으로 복구)

create table meals (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  type text not null,
  name text not null default '',
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  intake text not null default '',
  -- 클라이언트(기기) 수정 시각. Last-Write-Wins 충돌 판정 기준.
  updated_at_ms bigint not null,
  -- 서버 수신 시각. pull 커서 기준 — 기기 시계가 어긋나도 변경분을 놓치지 않게 한다.
  server_updated_at timestamptz not null default now(),
  -- soft delete: 삭제 사실 자체를 다른 기기로 전파해야 하므로 행을 지우지 않는다.
  deleted boolean not null default false
);

create or replace function set_server_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.server_updated_at = now();
  return new;
end;
$$;

create trigger meals_server_ts
  before insert or update on meals
  for each row
  execute function set_server_updated_at();

alter table meals enable row level security;

create policy "own rows" on meals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index meals_pull_cursor on meals (user_id, server_updated_at);
