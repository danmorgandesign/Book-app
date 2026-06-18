
CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage classes" ON public.classes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_initial text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX children_class_id_idx ON public.children(class_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.children TO authenticated;
GRANT ALL ON public.children TO service_role;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage children" ON public.children FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  loaned_at timestamptz NOT NULL DEFAULT now(),
  returned_at timestamptz
);
CREATE INDEX loans_book_id_idx ON public.loans(book_id);
CREATE INDEX loans_child_id_idx ON public.loans(child_id);
CREATE UNIQUE INDEX loans_one_active_per_book ON public.loans(book_id) WHERE returned_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loans TO authenticated;
GRANT ALL ON public.loans TO service_role;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage loans" ON public.loans FOR ALL TO authenticated USING (true) WITH CHECK (true);
