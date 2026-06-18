
-- 1. Promote danmorgan to admin
UPDATE public.user_roles
SET role = 'admin'
WHERE user_id = 'a1fc99ff-8edf-4962-bc46-16a5e5b875a9';

-- 2. Helper: is the current user a teacher or admin?
CREATE OR REPLACE FUNCTION public.is_library_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'teacher')
  )
$$;

-- Lock down EXECUTE on security-definer helpers
REVOKE EXECUTE ON FUNCTION public.is_library_staff(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_library_staff(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
-- authenticated still needs has_role for admin checks in policies/UI

-- 3. Replace permissive policies on classes / children / loans
DROP POLICY IF EXISTS "Authenticated can manage classes" ON public.classes;
DROP POLICY IF EXISTS "Authenticated can manage children" ON public.children;
DROP POLICY IF EXISTS "Authenticated can manage loans" ON public.loans;

CREATE POLICY "Library staff manage classes"
ON public.classes FOR ALL TO authenticated
USING (public.is_library_staff(auth.uid()))
WITH CHECK (public.is_library_staff(auth.uid()));

CREATE POLICY "Library staff manage children"
ON public.children FOR ALL TO authenticated
USING (public.is_library_staff(auth.uid()))
WITH CHECK (public.is_library_staff(auth.uid()));

CREATE POLICY "Library staff manage loans"
ON public.loans FOR ALL TO authenticated
USING (public.is_library_staff(auth.uid()))
WITH CHECK (public.is_library_staff(auth.uid()));

-- 4. user_roles: admins can view all + manage; users can still view their own
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users view own role"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles insert"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles update"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles delete"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
