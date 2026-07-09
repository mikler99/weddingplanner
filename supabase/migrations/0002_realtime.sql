-- =============================================================================
-- Realtime — publish the budget-driving tables so partners see each other's
-- edits live. RLS still applies to realtime for the authed client, so a user
-- only receives changes for weddings they're a member of.
-- REPLICA IDENTITY FULL so UPDATE/DELETE events carry the full old row
-- (needed for client-side merge + row removal).
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'weddings','budget_config','venue_costs','caterers','budget_lines','gifts'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when others then null;  -- already published; ignore
    end;
    execute format('alter table %I replica identity full', t);
  end loop;
end $$;
