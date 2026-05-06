create or replace function public._submission_edit_token_hash(p_token text)
returns text
language sql
immutable
as $$
  select encode(
    extensions.digest(convert_to(trim(both from coalesce(p_token, '')), 'UTF8'), 'sha256'),
    'hex'
  );
$$;
