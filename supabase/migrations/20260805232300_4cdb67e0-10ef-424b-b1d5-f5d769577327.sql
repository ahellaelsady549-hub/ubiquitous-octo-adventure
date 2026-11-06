CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.ward_progress (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  surah INTEGER NOT NULL DEFAULT 1,
  ayah INTEGER NOT NULL DEFAULT 1,
  daily_target INTEGER NOT NULL DEFAULT 20,
  ayahs_today INTEGER NOT NULL DEFAULT 0,
  last_read_date DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ward_progress TO authenticated;
GRANT ALL ON public.ward_progress TO service_role;
ALTER TABLE public.ward_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ward" ON public.ward_progress FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.tasbih_counts (
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  phrase TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, phrase)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasbih_counts TO authenticated;
GRANT ALL ON public.tasbih_counts TO service_role;
ALTER TABLE public.tasbih_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasbih" ON public.tasbih_counts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.ward_progress (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();