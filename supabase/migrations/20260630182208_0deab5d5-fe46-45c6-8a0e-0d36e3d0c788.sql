DROP POLICY IF EXISTS "Anyone can add books" ON public.books;
DROP POLICY IF EXISTS "Anyone can update books" ON public.books;
CREATE POLICY "Library staff can add books" ON public.books FOR INSERT TO authenticated WITH CHECK (private.is_library_staff(auth.uid()));
CREATE POLICY "Library staff can update books" ON public.books FOR UPDATE TO authenticated USING (private.is_library_staff(auth.uid())) WITH CHECK (private.is_library_staff(auth.uid()));