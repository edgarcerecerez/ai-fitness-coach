-- Create storage bucket for meal images
-- This migration sets up the storage infrastructure for Phase 2

-- Create storage bucket for meal images
INSERT INTO storage.buckets (id, name, public) VALUES ('meal-images', 'meal-images', false)
ON CONFLICT (id) DO NOTHING;

-- Ensure RLS is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for meal images (with conditional checks to prevent duplicates)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Users can upload their own meal images'
    ) THEN
        CREATE POLICY "Users can upload their own meal images" TO authenticated ON storage.objects
        FOR INSERT WITH CHECK (bucket_id = 'meal-images' AND auth.uid()::text = (storage.foldername(name))[1]);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Users can view their own meal images'
    ) THEN
        CREATE POLICY "Users can view their own meal images" TO authenticated ON storage.objects
        FOR SELECT USING (auth.role() = 'authenticated' AND bucket_id = 'meal-images' AND auth.uid() IS NOT NULL AND auth.uid()::text = (storage.foldername(name))[1]);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Users can update their own meal images'
    ) THEN
        CREATE POLICY "Users can update their own meal images" TO authenticated ON storage.objects
        FOR UPDATE USING (auth.role() = 'authenticated' AND bucket_id = 'meal-images' AND auth.uid()::text = (storage.foldername(name))[1])
        WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'meal-images' AND auth.uid()::text = (storage.foldername(name))[1]);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Users can delete their own meal images'
    ) THEN
        CREATE POLICY "Users can delete their own meal images" TO authenticated ON storage.objects
        FOR DELETE USING (bucket_id = 'meal-images' AND auth.uid()::text = (storage.foldername(name))[1] AND auth.role() = 'authenticated');
    END IF;
END
$$; 