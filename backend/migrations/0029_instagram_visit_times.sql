-- Private arrival/departure times; the existing unique visit-day count remains intact.
ALTER TABLE finfolk.checkins ADD COLUMN checked_in_at timestamptz;
ALTER TABLE finfolk.checkins ADD COLUMN checked_out_at timestamptz;
ALTER TABLE finfolk.checkins ADD CONSTRAINT checkins_departure_order
 CHECK(checked_out_at IS NULL OR (checked_in_at IS NOT NULL AND checked_out_at >= checked_in_at));
CREATE UNIQUE INDEX checkins_active_member ON finfolk.checkins(user_id)
 WHERE checked_in_at IS NOT NULL AND checked_out_at IS NULL;
-- Preserve the operator's mode, pilot audience, generation and other commands.
UPDATE finfolk.messaging_accounts SET enabled_commands=(
 SELECT coalesce(jsonb_agg(DISTINCT name ORDER BY name),'[]'::jsonb)
 FROM jsonb_array_elements_text(enabled_commands) existing(command)
 CROSS JOIN LATERAL unnest(CASE WHEN command='checkin' THEN ARRAY['in','out'] ELSE ARRAY[command] END) expanded(name)
) WHERE enabled_commands ? 'checkin';
