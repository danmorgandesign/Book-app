
-- Private schema, not exposed by PostgREST
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Recreate helpers in private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION private.is_library_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'teacher')
  )
$$;

REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.is_library_staff(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION private.is_library_staff(uuid) TO authenticated, service_role;

-- Repoint policies to private helpers
DROP POLICY IF EXISTS "Library staff manage classes"  ON public.classes;
DROP POLICY IF EXISTS "Library staff manage children" ON public.children;
DROP POLICY IF EXISTS "Library staff manage loans"    ON public.loans;
DROP POLICY IF EXISTS "Users view own role"           ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles insert"    ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles update"    ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles delete"    ON public.user_roles;

CREATE POLICY "Library staff manage classes"
ON public.classes FOR ALL TO authenticated
USING (private.is_library_staff(auth.uid()))
WITH CHECK (private.is_library_staff(auth.uid()));

CREATE POLICY "Library staff manage children"
ON public.children FOR ALL TO authenticated
USING (private.is_library_staff(auth.uid()))
WITH CHECK (private.is_library_staff(auth.uid()));

CREATE POLICY "Library staff manage loans"
ON public.loans FOR ALL TO authenticated
USING (private.is_library_staff(auth.uid()))
WITH CHECK (private.is_library_staff(auth.uid()));

CREATE POLICY "Users view own role"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles insert"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles update"
ON public.user_roles FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'))
WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles delete"
ON public.user_roles FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

-- Drop now-unused public helpers
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_library_staff(uuid);
