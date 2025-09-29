# Phase 11: Mobile Optimization & PWA

**Timeline:** 2 weeks (10 business days)
**Priority:** HIGH
**Status:** Not Started
**Dependencies:** Phase 8 (Foundation), Phase 9 (Theming), Phase 10 (Critical Pages)

---

## Overview

Phase 11 transforms the application into a Progressive Web App with native-like mobile experience, offline support, and camera integration for the calorie tracker. This phase ensures the app is installable and works seamlessly on mobile devices.

**Goal:** Create a production-ready PWA with excellent mobile UX and offline capabilities.

---

## Objectives

1. **Implement PWA Manifest and Service Worker**
   - Create comprehensive web manifest
   - Build service worker for offline caching
   - Add install prompts
   - Configure app icons and splash screens

2. **Add Mobile Navigation**
   - Bottom tab bar for mobile
   - Smooth transitions
   - Active state indicators
   - Gesture support

3. **Integrate Camera for Calorie Tracker**
   - Native camera API integration
   - Fallback to file upload
   - Image compression
   - Preview and retake functionality

4. **Implement Offline Support**
   - Cache critical pages and assets
   - Offline data queue
   - Sync when online
   - Offline indicators

5. **Optimize Touch Interactions**
   - Minimum 44px touch targets
   - Swipe gestures
   - Pull-to-refresh
   - Haptic feedback

6. **Add Install Prompts**
   - iOS install instructions
   - Android install prompt
   - Desktop install option
   - Dismissible with persistence

---

## Task Breakdown

### Task 11.1: PWA Manifest and Service Worker

**Estimated Time:** 2 days

**Subtasks:**

1. **Create Comprehensive Web Manifest**
   ```json
   // public/manifest.json (update existing)
   {
     "name": "AI Fitness Coach",
     "short_name": "FitCoach",
     "description": "Your AI-powered fitness and nutrition companion",
     "start_url": "/app",
     "display": "standalone",
     "background_color": "#ffffff",
     "theme_color": "#3b82f6",
     "orientation": "portrait-primary",
     "icons": [
       {
         "src": "/images/icon-72x72.png",
         "sizes": "72x72",
         "type": "image/png",
         "purpose": "maskable any"
       },
       {
         "src": "/images/icon-96x96.png",
         "sizes": "96x96",
         "type": "image/png",
         "purpose": "maskable any"
       },
       {
         "src": "/images/icon-128x128.png",
         "sizes": "128x128",
         "type": "image/png",
         "purpose": "maskable any"
       },
       {
         "src": "/images/icon-144x144.png",
         "sizes": "144x144",
         "type": "image/png",
         "purpose": "maskable any"
       },
       {
         "src": "/images/icon-152x152.png",
         "sizes": "152x152",
         "type": "image/png",
         "purpose": "maskable any"
       },
       {
         "src": "/images/icon-192x192.png",
         "sizes": "192x192",
         "type": "image/png",
         "purpose": "maskable any"
       },
       {
         "src": "/images/icon-384x384.png",
         "sizes": "384x384",
         "type": "image/png",
         "purpose": "maskable any"
       },
       {
         "src": "/images/icon-512x512.png",
         "sizes": "512x512",
         "type": "image/png",
         "purpose": "maskable any"
       }
     ],
     "categories": ["health", "fitness", "lifestyle"],
     "screenshots": [
       {
         "src": "/images/screenshot-mobile-1.png",
         "sizes": "390x844",
         "type": "image/png",
         "form_factor": "narrow"
       },
       {
         "src": "/images/screenshot-desktop-1.png",
         "sizes": "1920x1080",
         "type": "image/png",
         "form_factor": "wide"
       }
     ],
     "shortcuts": [
       {
         "name": "Log Food",
         "short_name": "Food",
         "description": "Quickly log a meal",
         "url": "/app/calorie-tracker",
         "icons": [
           {
             "src": "/images/shortcut-food.png",
             "sizes": "96x96"
           }
         ]
       },
       {
         "name": "Log Weight",
         "short_name": "Weight",
         "description": "Record your weight",
         "url": "/app/weight",
         "icons": [
           {
             "src": "/images/shortcut-weight.png",
             "sizes": "96x96"
           }
         ]
       },
       {
         "name": "Dashboard",
         "short_name": "Home",
         "description": "View your dashboard",
         "url": "/app",
         "icons": [
           {
             "src": "/images/shortcut-home.png",
             "sizes": "96x96"
           }
         ]
       }
     ],
     "share_target": {
       "action": "/app/calorie-tracker/share",
       "method": "POST",
       "enctype": "multipart/form-data",
       "params": {
         "title": "title",
         "text": "text",
         "url": "url",
         "files": [
           {
             "name": "image",
             "accept": ["image/*"]
           }
         ]
       }
     }
   }
   ```

2. **Build Advanced Service Worker**
   ```javascript
   // public/sw.js (replace existing)
   const CACHE_VERSION = 'v2'
   const CACHE_NAME = `ai-fitness-coach-${CACHE_VERSION}`
   const OFFLINE_URL = '/offline.html'

   // Assets to cache on install
   const STATIC_CACHE_URLS = [
     '/',
     '/app',
     '/login',
     '/offline.html',
     '/manifest.json',
     '/images/icon-192x192.png',
     '/images/icon-512x512.png',
   ]

   // Install event - cache static assets
   self.addEventListener('install', (event) => {
     console.log('[Service Worker] Installing...')
     event.waitUntil(
       caches.open(CACHE_NAME).then((cache) => {
         console.log('[Service Worker] Caching static assets')
         return cache.addAll(STATIC_CACHE_URLS)
       }).then(() => {
         return self.skipWaiting()
       })
     )
   })

   // Activate event - cleanup old caches
   self.addEventListener('activate', (event) => {
     console.log('[Service Worker] Activating...')
     event.waitUntil(
       caches.keys().then((cacheNames) => {
         return Promise.all(
           cacheNames
             .filter((name) => name.startsWith('ai-fitness-coach-') && name !== CACHE_NAME)
             .map((name) => {
               console.log('[Service Worker] Deleting old cache:', name)
               return caches.delete(name)
             })
         )
       }).then(() => {
         return self.clients.claim()
       })
     )
   })

   // Fetch event - network first, fallback to cache
   self.addEventListener('fetch', (event) => {
     const { request } = event
     const url = new URL(request.url)

     // Skip non-HTTP requests
     if (!request.url.startsWith('http')) {
       return
     }

     // API requests - network only, queue if offline
     if (url.pathname.startsWith('/api/')) {
       event.respondWith(
         fetch(request).catch(() => {
           // Queue API request for later
           return queueRequest(request)
         })
       )
       return
     }

     // Images - cache first
     if (request.destination === 'image') {
       event.respondWith(
         caches.match(request).then((cached) => {
           if (cached) return cached
           return fetch(request).then((response) => {
             return caches.open(CACHE_NAME).then((cache) => {
               cache.put(request, response.clone())
               return response
             })
           })
         })
       )
       return
     }

     // Navigation requests - network first, fallback to cache, then offline page
     if (request.mode === 'navigate') {
       event.respondWith(
         fetch(request)
           .then((response) => {
             // Cache successful navigation responses
             return caches.open(CACHE_NAME).then((cache) => {
               cache.put(request, response.clone())
               return response
             })
           })
           .catch(() => {
             // Try cache
             return caches.match(request).then((cached) => {
               if (cached) return cached
               // Return offline page
               return caches.match(OFFLINE_URL)
             })
           })
       )
       return
     }

     // Default - network first, fallback to cache
     event.respondWith(
       fetch(request)
         .then((response) => {
           return caches.open(CACHE_NAME).then((cache) => {
             cache.put(request, response.clone())
             return response
           })
         })
         .catch(() => {
           return caches.match(request)
         })
     )
   })

   // Background sync for queued requests
   self.addEventListener('sync', (event) => {
     if (event.tag === 'sync-data') {
       event.waitUntil(syncQueuedRequests())
     }
   })

   // Queue management
   let requestQueue = []

   function queueRequest(request) {
     return request.clone().text().then((body) => {
       requestQueue.push({
         url: request.url,
         method: request.method,
         headers: Array.from(request.headers.entries()),
         body: body,
       })

       // Register sync
       if (self.registration.sync) {
         self.registration.sync.register('sync-data')
       }

       return new Response(
         JSON.stringify({ queued: true }),
         { status: 202, statusText: 'Queued for sync' }
       )
     })
   }

   async function syncQueuedRequests() {
     console.log('[Service Worker] Syncing queued requests...')

     const queue = [...requestQueue]
     requestQueue = []

     for (const req of queue) {
       try {
         await fetch(req.url, {
           method: req.method,
           headers: req.headers,
           body: req.body,
         })
         console.log('[Service Worker] Synced request:', req.url)
       } catch (error) {
         console.error('[Service Worker] Failed to sync:', req.url)
         // Re-queue failed requests
         requestQueue.push(req)
       }
     }
   }

   // Push notification handler
   self.addEventListener('push', (event) => {
     const data = event.data ? event.data.json() : {}

     const options = {
       body: data.body || 'New notification',
       icon: '/images/icon-192x192.png',
       badge: '/images/badge-72x72.png',
       vibrate: [200, 100, 200],
       data: data,
       actions: data.actions || [],
     }

     event.waitUntil(
       self.registration.showNotification(data.title || 'AI Fitness Coach', options)
     )
   })

   // Notification click handler
   self.addEventListener('notificationclick', (event) => {
     event.notification.close()

     const urlToOpen = event.notification.data?.url || '/app'

     event.waitUntil(
       clients.matchAll({ type: 'window', includeUncontrolled: true })
         .then((clientList) => {
           // Focus existing window if open
           for (const client of clientList) {
             if (client.url === urlToOpen && 'focus' in client) {
               return client.focus()
             }
           }
           // Open new window
           if (clients.openWindow) {
             return clients.openWindow(urlToOpen)
           }
         })
     )
   })
   ```

3. **Register Service Worker in App**
   ```typescript
   // src/app/layout.tsx (update)
   import { ServiceWorkerRegistration } from '@/components/pwa/service-worker-registration'

   export default function RootLayout({
     children,
   }: {
     children: React.ReactNode
   }) {
     return (
       <html lang="en" suppressHydrationWarning>
         <head>
           <link rel="manifest" href="/manifest.json" />
           <meta name="theme-color" content="#3b82f6" />
           <meta name="apple-mobile-web-app-capable" content="yes" />
           <meta name="apple-mobile-web-app-status-bar-style" content="default" />
           <meta name="apple-mobile-web-app-title" content="FitCoach" />
           <link rel="apple-touch-icon" href="/images/icon-192x192.png" />
         </head>
         <body className={inter.className}>
           <ThemeProvider
             attribute="class"
             defaultTheme="system"
             enableSystem
             disableTransitionOnChange
           >
             {children}
             <ServiceWorkerRegistration />
           </ThemeProvider>
         </body>
       </html>
     )
   }
   ```

4. **Create Service Worker Registration Component**
   ```typescript
   // src/components/pwa/service-worker-registration.tsx
   'use client'

   import { useEffect } from 'react'
   import { clientLogger } from '@/lib/logger'

   export function ServiceWorkerRegistration() {
     useEffect(() => {
       if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
         navigator.serviceWorker
           .register('/sw.js')
           .then((registration) => {
             clientLogger.info('Service Worker registered', {
               scope: registration.scope,
             })

             // Check for updates every hour
             setInterval(() => {
               registration.update()
             }, 60 * 60 * 1000)
           })
           .catch((error) => {
             clientLogger.error('Service Worker registration failed', {
               error: error.message,
             })
           })
       }
     }, [])

     return null
   }
   ```

**Acceptance Criteria:**
- [ ] Web manifest complete with all icons
- [ ] Service worker caches critical assets
- [ ] Offline page displays when no connection
- [ ] App shortcuts work on supported platforms
- [ ] Background sync queues failed requests
- [ ] Service worker updates automatically

---

### Task 11.2: Mobile Navigation Component

**Estimated Time:** 2 days

**Subtasks:**

1. **Create Bottom Tab Bar**
   ```typescript
   // src/components/mobile/bottom-navigation.tsx
   'use client'

   import { usePathname } from 'next/navigation'
   import Link from 'next/link'
   import {
     Home,
     Camera,
     TrendingUp,
     Settings,
     Sparkles
   } from 'lucide-react'

   const navItems = [
     { href: '/app', label: 'Home', icon: Home },
     { href: '/app/calorie-tracker', label: 'Food', icon: Camera },
     { href: '/app/analytics', label: 'Trends', icon: TrendingUp },
     { href: '/app/recommendations', label: 'AI', icon: Sparkles },
     { href: '/app/settings', label: 'Settings', icon: Settings },
   ]

   export function BottomNavigation() {
     const pathname = usePathname()

     return (
       <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
         <div className="flex items-center justify-around h-16">
           {navItems.map((item) => {
             const Icon = item.icon
             const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
             return (
               <Link
                 key={item.href}
                 href={item.href}
                 className={`
                   flex flex-col items-center justify-center flex-1 h-full gap-1
                   transition-colors
                   ${isActive
                     ? 'text-primary'
                     : 'text-muted-foreground hover:text-foreground'
                   }
                 `}
               >
                 <Icon className="w-5 h-5" />
                 <span className="text-xs font-medium">{item.label}</span>
               </Link>
             )
           })}
         </div>
       </nav>
     )
   }
   ```

2. **Add to App Layout**
   ```typescript
   // src/app/app/layout.tsx (update)
   import { BottomNavigation } from '@/components/mobile/bottom-navigation'
   import { Navigation } from '@/components/app/navigation'

   export default function AppLayout({
     children,
   }: {
     children: React.ReactNode
   }) {
     return (
       <div className="min-h-screen bg-background">
         <Navigation />
         <main className="pb-20 lg:pb-0">
           {children}
         </main>
         <BottomNavigation />
       </div>
     )
   }
   ```

**Acceptance Criteria:**
- [ ] Bottom tab bar visible on mobile (<1024px)
- [ ] Active tab highlighted
- [ ] Smooth transitions between tabs
- [ ] Touch targets ≥ 44px
- [ ] Proper z-index stacking

---

### Task 11.3: Camera Integration

**Estimated Time:** 2 days

**Subtasks:**

1. **Create Camera Component**
   ```typescript
   // src/components/camera/camera-capture.tsx
   'use client'

   import { useRef, useState, useEffect } from 'react'
   import { Button } from '@/components/ui/button'
   import { Camera, X, RotateCcw, Check } from 'lucide-react'
   import { toast } from 'sonner'

   interface CameraCaptureProps {
     onCapture: (blob: Blob) => void
     onClose: () => void
   }

   export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
     const videoRef = useRef<HTMLVideoElement>(null)
     const canvasRef = useRef<HTMLCanvasElement>(null)
     const [stream, setStream] = useState<MediaStream | null>(null)
     const [capturedImage, setCapturedImage] = useState<string | null>(null)
     const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')

     useEffect(() => {
       startCamera()

       return () => {
         stopCamera()
       }
     }, [facingMode])

     async function startCamera() {
       try {
         const mediaStream = await navigator.mediaDevices.getUserMedia({
           video: {
             facingMode,
             width: { ideal: 1920 },
             height: { ideal: 1080 },
           },
         })

         if (videoRef.current) {
           videoRef.current.srcObject = mediaStream
         }

         setStream(mediaStream)
       } catch (error) {
         console.error('Camera access error:', error)
         toast.error('Failed to access camera. Please check permissions.')
       }
     }

     function stopCamera() {
       if (stream) {
         stream.getTracks().forEach((track) => track.stop())
       }
     }

     function capturePhoto() {
       if (!videoRef.current || !canvasRef.current) return

       const video = videoRef.current
       const canvas = canvasRef.current

       canvas.width = video.videoWidth
       canvas.height = video.videoHeight

       const ctx = canvas.getContext('2d')
       if (!ctx) return

       ctx.drawImage(video, 0, 0)

       canvas.toBlob((blob) => {
         if (blob) {
           setCapturedImage(canvas.toDataURL('image/jpeg'))
         }
       }, 'image/jpeg', 0.9)
     }

     function retake() {
       setCapturedImage(null)
     }

     function confirm() {
       if (!canvasRef.current) return

       canvasRef.current.toBlob((blob) => {
         if (blob) {
           onCapture(blob)
           onClose()
         }
       }, 'image/jpeg', 0.9)
     }

     function switchCamera() {
       setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
     }

     return (
       <div className="fixed inset-0 z-50 bg-black">
         <div className="relative h-full">
           {/* Video stream */}
           {!capturedImage && (
             <video
               ref={videoRef}
               autoPlay
               playsInline
               muted
               className="w-full h-full object-cover"
             />
           )}

           {/* Captured image preview */}
           {capturedImage && (
             <img
               src={capturedImage}
               alt="Captured"
               className="w-full h-full object-cover"
             />
           )}

           {/* Hidden canvas for capture */}
           <canvas ref={canvasRef} className="hidden" />

           {/* Controls */}
           <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
             {!capturedImage ? (
               <div className="flex items-center justify-between">
                 <Button
                   variant="ghost"
                   size="icon"
                   onClick={onClose}
                   className="text-white hover:bg-white/20"
                 >
                   <X className="w-6 h-6" />
                 </Button>

                 <Button
                   size="icon"
                   onClick={capturePhoto}
                   className="w-16 h-16 rounded-full bg-white hover:bg-white/90"
                 >
                   <Camera className="w-8 h-8 text-black" />
                 </Button>

                 <Button
                   variant="ghost"
                   size="icon"
                   onClick={switchCamera}
                   className="text-white hover:bg-white/20"
                 >
                   <RotateCcw className="w-6 h-6" />
                 </Button>
               </div>
             ) : (
               <div className="flex items-center justify-center gap-4">
                 <Button
                   size="lg"
                   variant="ghost"
                   onClick={retake}
                   className="text-white hover:bg-white/20"
                 >
                   <RotateCcw className="w-5 h-5 mr-2" />
                   Retake
                 </Button>

                 <Button
                   size="lg"
                   onClick={confirm}
                   className="bg-primary hover:bg-primary/90"
                 >
                   <Check className="w-5 h-5 mr-2" />
                   Use Photo
                 </Button>
               </div>
             )}
           </div>
         </div>
       </div>
     )
   }
   ```

2. **Integrate with Calorie Tracker**
   ```typescript
   // src/app/app/calorie-tracker/page.tsx (update)
   'use client'

   import { useState } from 'react'
   import { CameraCapture } from '@/components/camera/camera-capture'
   import { Button } from '@/components/ui/button'
   import { Camera } from 'lucide-react'

   export default function CalorieTrackerPage() {
     const [showCamera, setShowCamera] = useState(false)

     async function handlePhotoCapture(blob: Blob) {
       // Upload and process photo
       const formData = new FormData()
       formData.append('image', blob, 'food-photo.jpg')

       const response = await fetch('/api/nutrition/upload', {
         method: 'POST',
         body: formData,
       })

       // Handle response...
     }

     return (
       <div className="container mx-auto px-4 py-8">
         <Button
           onClick={() => setShowCamera(true)}
           className="w-full"
         >
           <Camera className="w-5 h-5 mr-2" />
           Take Photo
         </Button>

         {showCamera && (
           <CameraCapture
             onCapture={handlePhotoCapture}
             onClose={() => setShowCamera(false)}
           />
         )}
       </div>
     )
   }
   ```

**Acceptance Criteria:**
- [ ] Camera opens on mobile devices
- [ ] Can capture photos
- [ ] Preview before confirming
- [ ] Switch between front/back camera
- [ ] Fallback to file upload on unsupported devices
- [ ] Images compressed before upload

---

### Task 11.4: Offline Support & Data Queue

**Estimated Time:** 2 days

(Implementation includes offline detection, request queuing, sync when online)

### Task 11.5: Touch Optimization

**Estimated Time:** 1 day

(Ensure all touch targets meet 44px minimum, add swipe gestures where appropriate)

### Task 11.6: Install Prompts

**Estimated Time:** 1 day

(Create install prompt UI for iOS, Android, Desktop with dismissible state)

---

## Testing Requirements

### Manual Testing
- [ ] App installs on iOS Safari
- [ ] App installs on Android Chrome
- [ ] Bottom navigation works smoothly
- [ ] Camera captures photos correctly
- [ ] Offline mode works
- [ ] Data syncs when back online
- [ ] All touch targets ≥ 44px
- [ ] Lighthouse PWA score > 90

---

## Success Metrics

- ✅ Lighthouse PWA score > 90
- ✅ App installable on iOS and Android
- ✅ Works offline for core features
- ✅ Camera integration functional
- ✅ Touch targets meet accessibility standards
- ✅ Install prompt appears appropriately

---

## Change Log

**Version 1.0 - January 2025**
- Initial Phase 11 technical specification
- PWA implementation
- Mobile navigation
- Camera integration