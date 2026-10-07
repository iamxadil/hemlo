-- The waiting-room screen: a display-only key, so a TV shows the queue without anyone signed in on it.
ALTER TABLE "dent_settings" ADD COLUMN IF NOT EXISTS "screen_key" text;
