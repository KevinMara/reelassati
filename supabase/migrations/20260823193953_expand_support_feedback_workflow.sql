alter table public.support_tickets
  drop constraint if exists support_tickets_category_check;

alter table public.support_tickets
  add constraint support_tickets_category_check
  check (
    category in (
      'account',
      'billing',
      'studio',
      'generation',
      'publishing',
      'privacy',
      'bug',
      'feedback',
      'other'
    )
  );

alter table public.support_tickets
  drop constraint if exists support_tickets_status_check;

alter table public.support_tickets
  add constraint support_tickets_status_check
  check (status in ('open', 'in_progress', 'planned', 'resolved', 'closed'));

create index if not exists support_tickets_feedback_triage_idx
  on public.support_tickets (category, status, priority, created_at desc)
  where category in ('bug', 'feedback');
