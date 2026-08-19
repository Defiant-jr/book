alter table public.pag_livres enable row level security;

grant select, insert, update, delete on table public.pag_livres to authenticated;

create policy "pag_livres_authenticated_select"
  on public.pag_livres
  for select
  to authenticated
  using (true);

create policy "pag_livres_authenticated_insert"
  on public.pag_livres
  for insert
  to authenticated
  with check (true);

create policy "pag_livres_authenticated_update"
  on public.pag_livres
  for update
  to authenticated
  using (true)
  with check (true);

create policy "pag_livres_authenticated_delete"
  on public.pag_livres
  for delete
  to authenticated
  using (true);
