-- Final fix for chama_members and related RLS policies

-- 1. Ensure chama_members has explicit policies for all operations
DROP POLICY IF EXISTS "Members can view other members in their chama" ON public.chama_members;
DROP POLICY IF EXISTS "Users can join chamas they created" ON public.chama_members;
DROP POLICY IF EXISTS "Admins can update members" ON public.chama_members;

-- SELECT: Users can see their own membership OR any membership in a chama they belong to
CREATE POLICY "chama_members_select_policy" 
ON public.chama_members 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.chama_members cm 
    WHERE cm.chama_id = chama_members.chama_id 
    AND cm.user_id = auth.uid()
  )
);

-- INSERT: Users can join chamas (if invited or public) or admins can add members
-- For now, let's allow users to insert their own membership record if they are the creator of the chama
-- OR if they are authenticated (simple model for demo)
CREATE POLICY "chama_members_insert_policy" 
ON public.chama_members 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id
);

-- UPDATE: Admins can update any member in their chama, users can update their own status (e.g. leaving)
CREATE POLICY "chama_members_update_policy" 
ON public.chama_members 
FOR UPDATE 
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM public.chama_members cm 
    WHERE cm.chama_id = chama_members.chama_id 
    AND cm.user_id = auth.uid() 
    AND cm.role = 'admin'
  )
);

-- 2. Ensure users table allows public viewing of basic info for members
DROP POLICY IF EXISTS "Public can view basic member info" ON public.users;
CREATE POLICY "Public can view basic member info" 
ON public.users 
FOR SELECT 
USING (true); -- Allowing all authenticated users to see user profiles for chama functionality

-- 3. Ensure chamas table is viewable by all authenticated users
DROP POLICY IF EXISTS "Chamas are viewable by everyone" ON public.chamas;
CREATE POLICY "Chamas are viewable by everyone" 
ON public.chamas 
FOR SELECT 
USING (true);
