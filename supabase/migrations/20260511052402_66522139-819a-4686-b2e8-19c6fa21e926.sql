create or replace function increment_user_spend(user_id uuid, amount_eur numeric)
returns void as $$
  update profiles
  set api_spend_this_cycle_eur = api_spend_this_cycle_eur + amount_eur,
      updated_at = now()
  where id = user_id;
$$ language sql;