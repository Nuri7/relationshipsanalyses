
ALTER TABLE public.chat_analyses ADD COLUMN anonymized BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.chat_analyses ADD COLUMN anonymized_map JSONB;
