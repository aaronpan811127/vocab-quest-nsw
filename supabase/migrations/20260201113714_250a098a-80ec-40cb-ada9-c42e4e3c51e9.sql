-- Add RLS policies for admins to manage units
CREATE POLICY "Admins can update units"
ON public.units
FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert units"
ON public.units
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete units"
ON public.units
FOR DELETE
USING (is_admin(auth.uid()));