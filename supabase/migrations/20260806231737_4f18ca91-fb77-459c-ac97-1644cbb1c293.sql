revoke all on function public.grant_owner_admin() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.is_restricted(uuid) from public, anon;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.is_restricted(uuid) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;