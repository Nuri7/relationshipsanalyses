CREATE POLICY "Users can delete own analyses"
ON public.chat_analyses
FOR DELETE
USING (auth.uid() = user_id);