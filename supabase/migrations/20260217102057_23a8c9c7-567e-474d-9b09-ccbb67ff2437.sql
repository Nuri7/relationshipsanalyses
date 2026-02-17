
ALTER TABLE public.chat_uploads ADD COLUMN file_path TEXT;
ALTER TABLE public.chat_analyses ADD COLUMN participants JSONB;
ALTER TABLE public.chat_analyses ADD CONSTRAINT chat_analyses_upload_id_key UNIQUE (upload_id);
