-- roles
create type public.app_role as enum ('admin','user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "admins read all roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- grant admin to the designated owner email (only while no admin exists yet)
create or replace function public.grant_owner_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) = 'mozizooo443@gmail.com'
     and not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict do nothing;
  end if;
  return new;
end; $$;
create trigger on_auth_user_created_owner_admin
after insert on auth.users for each row execute function public.grant_owner_admin();

-- restrictions
create table public.user_restrictions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  banned_until timestamptz,
  permanent boolean not null default false,
  reason text,
  created_at timestamptz not null default now()
);
grant select on public.user_restrictions to authenticated, anon;
grant all on public.user_restrictions to service_role;
alter table public.user_restrictions enable row level security;
create policy "restrictions readable" on public.user_restrictions for select using (true);
create policy "admins manage restrictions" on public.user_restrictions for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.is_restricted(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_restrictions r
    where r.user_id = _user_id and (r.permanent or (r.banned_until is not null and r.banned_until > now()))
  )
$$;

-- profiles readable by everyone (display names in the feed)
create policy "profiles public read" on public.profiles for select using (true);
grant select on public.profiles to anon;

-- posts
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  kind text not null default 'post' check (kind in ('post','question','reel')),
  content text not null check (char_length(content) between 1 and 5000),
  media_url text,
  comments_disabled boolean not null default false,
  as_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create index posts_created_idx on public.posts (created_at desc);
grant select on public.posts to anon;
grant select, insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "posts public read" on public.posts for select using (true);
create policy "posts insert own" on public.posts for insert to authenticated
  with check (auth.uid() = user_id and not public.is_restricted(auth.uid())
    and (not as_admin or public.has_role(auth.uid(),'admin')));
create policy "posts update own" on public.posts for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "posts delete own or admin" on public.posts for delete to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

-- comments
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);
grant select on public.comments to anon;
grant select, insert, delete on public.comments to authenticated;
grant all on public.comments to service_role;
alter table public.comments enable row level security;
create policy "comments public read" on public.comments for select using (true);
create policy "comments insert allowed" on public.comments for insert to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_restricted(auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id and (p.comments_disabled = false or p.user_id = auth.uid()))
  );
create policy "comments delete own post-owner or admin" on public.comments for delete to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin')
    or exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()));

-- reactions
create table public.reactions (
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  kind text not null default 'like' check (kind in ('like','love','dua','mashallah','sad')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
grant select on public.reactions to anon;
grant select, insert, update, delete on public.reactions to authenticated;
grant all on public.reactions to service_role;
alter table public.reactions enable row level security;
create policy "reactions public read" on public.reactions for select using (true);
create policy "reactions manage own" on public.reactions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id and not public.is_restricted(auth.uid()));

-- reports
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete cascade not null,
  reported_user_id uuid references auth.users(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 1000),
  status text not null default 'pending' check (status in ('pending','resolved','dismissed')),
  created_at timestamptz not null default now()
);
grant select, insert, update on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "reports insert own" on public.reports for insert to authenticated
  with check (auth.uid() = reporter_id);
create policy "reports read own or admin" on public.reports for select to authenticated
  using (auth.uid() = reporter_id or public.has_role(auth.uid(),'admin'));
create policy "reports admin update" on public.reports for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- saved items
create table public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  kind text not null check (kind in ('ayah','surah','hadith','zikr','tasbih','ward')),
  ref text not null,
  label text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);
grant select, insert, update, delete on public.saved_items to authenticated;
grant all on public.saved_items to service_role;
alter table public.saved_items enable row level security;
create policy "own saved items" on public.saved_items for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- custom azkar
create table public.custom_azkar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null check (char_length(text) between 1 and 1000),
  target integer not null default 33 check (target between 1 and 10000),
  benefit text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.custom_azkar to authenticated;
grant all on public.custom_azkar to service_role;
alter table public.custom_azkar enable row level security;
create policy "own custom azkar" on public.custom_azkar for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);