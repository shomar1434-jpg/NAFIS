-- NAFIS cloud schema draft.
-- Apply only to a dedicated NAFIS Supabase project after it is created.
-- Authorization roles must be written to auth.users.raw_app_meta_data by a trusted server process.

create extension if not exists pgcrypto;

create type public.nafis_role as enum ('owner','system_admin','teacher','student');
create type public.content_status as enum ('draft','review','published','archived');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.nafis_role not null,
  full_name text not null,
  school_name text not null default 'مدرسة الصفا المتوسطة بجازان',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(user_id) on delete cascade,
  stage text not null,
  grade text not null,
  class_room text,
  subject text not null,
  is_active boolean not null default true,
  unique (teacher_id, stage, grade, class_room, subject)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  student_number text unique,
  full_name text not null,
  stage text not null,
  grade text not null,
  class_room text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.test_catalog (
  id text primary key,
  title text not null,
  stage text not null,
  grade text not null,
  subject text not null,
  page_path text not null,
  status public.content_status not null default 'draft',
  created_by uuid references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  test_id text not null references public.test_catalog(id) on delete cascade,
  domain_name text not null,
  skill_name text not null,
  unique(test_id, skill_name)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  client_attempt_id text unique not null,
  student_id uuid not null references public.students(id) on delete cascade,
  test_id text not null references public.test_catalog(id),
  correct_count integer not null check (correct_count >= 0),
  question_count integer not null check (question_count > 0),
  percent numeric(5,2) not null check (percent between 0 and 100),
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.attempt_skill_results (
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  skill_id uuid not null references public.skills(id),
  correct_count integer not null check (correct_count >= 0),
  question_count integer not null check (question_count > 0),
  percent numeric(5,2) not null check (percent between 0 and 100),
  primary key (attempt_id, skill_id)
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content_type text not null,
  stage text,
  grade text,
  subject text,
  storage_path text,
  status public.content_status not null default 'draft',
  created_by uuid not null references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.development_notes (
  id uuid primary key default gen_random_uuid(),
  page_key text not null,
  note_text text not null,
  priority text not null default 'medium',
  status text not null default 'open',
  created_by uuid not null references public.profiles(user_id),
  created_at timestamptz not null default now()
);

create index attempts_student_test_idx on public.attempts(student_id,test_id,completed_at desc);
create index students_scope_idx on public.students(grade,class_room);
create index teacher_assignments_scope_idx on public.teacher_assignments(teacher_id,grade,subject) where is_active;

alter table public.profiles enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.students enable row level security;
alter table public.test_catalog enable row level security;
alter table public.skills enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_skill_results enable row level security;
alter table public.content_items enable row level security;
alter table public.development_notes enable row level security;

create policy profiles_read_self_or_admin on public.profiles for select to authenticated
using ((select auth.uid()) = user_id or (select auth.jwt()->'app_metadata'->>'role') in ('owner','system_admin'));
create policy profiles_update_self_or_admin on public.profiles for update to authenticated
using ((select auth.uid()) = user_id or (select auth.jwt()->'app_metadata'->>'role') in ('owner','system_admin'))
with check ((select auth.uid()) = user_id or (select auth.jwt()->'app_metadata'->>'role') in ('owner','system_admin'));

create policy assignments_read_scope on public.teacher_assignments for select to authenticated
using (teacher_id = (select auth.uid()) or (select auth.jwt()->'app_metadata'->>'role') in ('owner','system_admin'));
create policy assignments_admin_write on public.teacher_assignments for all to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') in ('owner','system_admin'))
with check ((select auth.jwt()->'app_metadata'->>'role') in ('owner','system_admin'));

create policy students_read_authorized on public.students for select to authenticated using (
  auth_user_id = (select auth.uid())
  or (select auth.jwt()->'app_metadata'->>'role') in ('owner','system_admin')
  or exists (select 1 from public.teacher_assignments a where a.teacher_id=(select auth.uid()) and a.is_active and a.grade=students.grade and (a.class_room is null or a.class_room=students.class_room))
);
create policy students_admin_write on public.students for all to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') in ('owner','system_admin'))
with check ((select auth.jwt()->'app_metadata'->>'role') in ('owner','system_admin'));

create policy catalog_public_read on public.test_catalog for select to anon,authenticated using (status='published');
create policy catalog_owner_write on public.test_catalog for all to authenticated
using ((select auth.jwt()->'app_metadata'->>'role')='owner')
with check ((select auth.jwt()->'app_metadata'->>'role')='owner');
create policy skills_public_read on public.skills for select to anon,authenticated using (true);
create policy skills_owner_write on public.skills for all to authenticated
using ((select auth.jwt()->'app_metadata'->>'role')='owner')
with check ((select auth.jwt()->'app_metadata'->>'role')='owner');

create policy attempts_read_authorized on public.attempts for select to authenticated using (
  exists (select 1 from public.students s where s.id=attempts.student_id and (
    s.auth_user_id=(select auth.uid())
    or (select auth.jwt()->'app_metadata'->>'role') in ('owner','system_admin')
    or exists (select 1 from public.teacher_assignments a join public.test_catalog t on t.id=attempts.test_id where a.teacher_id=(select auth.uid()) and a.is_active and a.grade=s.grade and a.subject=t.subject and (a.class_room is null or a.class_room=s.class_room))
  ))
);
create policy attempts_student_insert on public.attempts for insert to authenticated
with check (exists (select 1 from public.students s where s.id=student_id and s.auth_user_id=(select auth.uid())));

create policy skill_results_read_via_attempt on public.attempt_skill_results for select to authenticated
using (exists (select 1 from public.attempts a where a.id=attempt_id));
create policy skill_results_student_insert on public.attempt_skill_results for insert to authenticated
with check (exists (select 1 from public.attempts a join public.students s on s.id=a.student_id where a.id=attempt_id and s.auth_user_id=(select auth.uid())));

create policy content_read_published_or_staff on public.content_items for select to authenticated
using (status='published' or (select auth.jwt()->'app_metadata'->>'role') in ('owner','system_admin','teacher'));
create policy content_owner_write on public.content_items for all to authenticated
using ((select auth.jwt()->'app_metadata'->>'role')='owner')
with check ((select auth.jwt()->'app_metadata'->>'role')='owner' and created_by=(select auth.uid()));

create policy notes_admin_read on public.development_notes for select to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') in ('owner','system_admin'));
create policy notes_admin_insert on public.development_notes for insert to authenticated
with check ((select auth.jwt()->'app_metadata'->>'role') in ('owner','system_admin') and created_by=(select auth.uid()));
create policy notes_owner_update on public.development_notes for update to authenticated
using ((select auth.jwt()->'app_metadata'->>'role')='owner')
with check ((select auth.jwt()->'app_metadata'->>'role')='owner');

grant usage on schema public to anon,authenticated;
grant select on public.test_catalog,public.skills to anon;
grant select,insert,update,delete on all tables in schema public to authenticated;
