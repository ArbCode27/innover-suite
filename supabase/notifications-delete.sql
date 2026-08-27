drop policy if exists "Members can delete notifications" on public.notifications;
create policy "Members can delete notifications" on public.notifications
for delete to authenticated
using (public.is_org_member(organization_id) and (user_id is null or user_id = auth.uid()));
