-- posts
DROP POLICY IF EXISTS "posts public read" ON public.posts;
CREATE POLICY "posts read authenticated" ON public.posts FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.posts FROM anon;

-- comments
DROP POLICY IF EXISTS "comments public read" ON public.comments;
CREATE POLICY "comments read authenticated" ON public.comments FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.comments FROM anon;

-- reactions
DROP POLICY IF EXISTS "reactions public read" ON public.reactions;
CREATE POLICY "reactions read authenticated" ON public.reactions FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.reactions FROM anon;

-- profiles
DROP POLICY IF EXISTS "profiles public read" ON public.profiles;
CREATE POLICY "profiles read authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.profiles FROM anon;

-- storage: community-media read restricted to authenticated users
DROP POLICY IF EXISTS "community media public read" ON storage.objects;
DROP POLICY IF EXISTS "community-media public read" ON storage.objects;
DROP POLICY IF EXISTS "community media read" ON storage.objects;
CREATE POLICY "community media read authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'community-media');