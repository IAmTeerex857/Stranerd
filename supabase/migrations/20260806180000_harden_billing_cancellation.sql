create or replace function public.mark_spotflow_cancellation_requested(
  p_subscription_id uuid,
  p_user_id uuid,
  p_requested_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.subscriptions
  set cancel_at_period_end = true,
      metadata = metadata || jsonb_build_object('cancellationRequestedAt', p_requested_at)
  where id = p_subscription_id
    and user_id = p_user_id
    and status in ('active', 'past_due');

  if not found then
    raise exception 'cancellable subscription not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.mark_spotflow_cancellation_requested(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.mark_spotflow_cancellation_requested(uuid, uuid, timestamptz) to service_role;
