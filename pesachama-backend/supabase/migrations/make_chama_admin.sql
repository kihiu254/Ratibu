-- Make a user an ADMIN in ALL Chamas they belong to
-- Replace 'YOUR_EMAIL@EXAMPLE.COM' with the actual email address

UPDATE public.chama_members
SET role = 'admin'
WHERE user_id = (SELECT id FROM public.users WHERE email = 'YOUR_EMAIL@EXAMPLE.COM');

-- Verify the update
SELECT cm.role, c.name as chama_name 
FROM public.chama_members cm
JOIN public.chamas c ON cm.chama_id = c.id
JOIN public.users u ON cm.user_id = u.id
WHERE u.email = 'YOUR_EMAIL@EXAMPLE.COM';
