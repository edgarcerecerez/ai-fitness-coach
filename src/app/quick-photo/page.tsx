'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { OptimizedCamera } from '@/components/calorie-tracker/OptimizedCamera';
import { imageOptimizer } from '@/lib/image/optimizer';
import { syncService } from '@/lib/pwa/sync-service';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@supabase/supabase-js';

export default function QuickPhotoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  const checkAuth = useCallback(async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        toast({
          title: "Authentication required",
          description: "Please log in to upload photos",
        });
        router.push('/login');
        return;
      }
      setUser(user);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Auth check failed:', message);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  }, [router, supabase.auth, toast]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return null; // Will redirect to login
  }

  const handlePhotoCapture = async (photo: File) => {
    try {
      // Optimize the image
      const optimizedPhoto = await imageOptimizer.optimizeForUpload(photo);

      toast({
        title: "Processing photo...",
        description: "AI is analyzing your meal"
      });

      // Read as base64 in a promise to await
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result?.toString().split(',')[1] ?? '');
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
        reader.readAsDataURL(optimizedPhoto);
      });

      if (!syncService) {
        throw new Error('Sync service not available');
      }

      const signedUrl = await syncService.queuePhotoUpload({
        fileName: optimizedPhoto.name,
        base64,
        mimeType: optimizedPhoto.type,
        user_id: user.id
      });

      if (signedUrl) {
        toast({ title: 'Photo uploaded!', description: 'Photo uploaded successfully and ready for processing' });
      } else {
        toast({ title: 'Photo queued', description: 'Photo saved and will be uploaded when online' });
      }

      // Navigate only after successful queue/upload
      router.push('/');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Failed to process or queue photo:', message);
      toast({
        title: 'Error',
        description: 'Failed to process photo',
        variant: 'destructive'
      });
    }
  };

  const handleCancel = () => {
    router.push('/');
  };

  return (
    <OptimizedCamera
      onCapture={handlePhotoCapture}
      onCancel={handleCancel}
      showGuidelines={true}
    />
  );
}