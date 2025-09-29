# Phase 9: Real-time Foundation & Theming

**Timeline:** 1 week (5 business days)
**Priority:** CRITICAL
**Status:** Not Started
**Dependencies:** Phase 8 (Foundation Cleanup)

---

## Overview

Phase 9 establishes real-time data synchronization using Supabase subscriptions and completes the theming system by removing all hardcoded Tailwind colors from the codebase. This phase ensures the application is fully theme-aware and provides instant updates when data changes.

**Goal:** Create a responsive, theme-compliant application with real-time data updates.

---

## Objectives

1. **Implement Supabase Real-time Subscriptions**
   - Create reusable `useRealtimeSubscription` hook
   - Add real-time updates for weight_logs
   - Add real-time updates for nutrition_logs
   - Add real-time updates for mood_logs

2. **Complete Theming System**
   - Audit all 154 TypeScript files for hardcoded colors
   - Replace ALL hardcoded Tailwind colors with theme variables
   - Create theme switcher component
   - Add theme preference persistence

3. **Document Theme Patterns**
   - Create theme usage guide
   - Document color mapping
   - Provide migration examples

4. **Responsive Breakpoint Standardization**
   - Establish standard breakpoints
   - Document mobile-first approach
   - Audit and fix responsive issues

---

## Task Breakdown

### Task 9.1: Implement Real-time Subscription Hook

**Estimated Time:** 1 day

**Subtasks:**

1. **Create Core Hook**
   ```typescript
   // src/hooks/useRealtimeSubscription.ts
   'use client'

   import { useEffect, useState } from 'react'
   import { createBrowserClient } from '@/utils/supabase/client'
   import { RealtimeChannel } from '@supabase/supabase-js'
   import { clientLogger } from '@/lib/logger'

   export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE'
   export type RealtimeFilter = {
     column: string
     value: string
   }

   export interface UseRealtimeSubscriptionOptions<T> {
     table: string
     event?: RealtimeEvent | RealtimeEvent[]
     filter?: RealtimeFilter
     schema?: string
     onInsert?: (payload: T) => void
     onUpdate?: (payload: { old: T; new: T }) => void
     onDelete?: (payload: T) => void
   }

   export function useRealtimeSubscription<T = any>(
     options: UseRealtimeSubscriptionOptions<T>
   ) {
     const {
       table,
       event = ['INSERT', 'UPDATE', 'DELETE'],
       filter,
       schema = 'public',
       onInsert,
       onUpdate,
       onDelete,
     } = options

     const [channel, setChannel] = useState<RealtimeChannel | null>(null)
     const [error, setError] = useState<Error | null>(null)
     const [isConnected, setIsConnected] = useState(false)

     useEffect(() => {
       const supabase = createBrowserClient()

       // Build channel name
       const channelName = filter
         ? `${table}:${filter.column}=eq.${filter.value}`
         : table

       clientLogger.debug('Setting up realtime subscription', {
         table,
         channelName,
         events: Array.isArray(event) ? event : [event],
       })

       // Create channel
       let realtimeChannel = supabase
         .channel(channelName)
         .on(
           'postgres_changes',
           {
             event: Array.isArray(event) ? '*' : event,
             schema,
             table,
             filter: filter ? `${filter.column}=eq.${filter.value}` : undefined,
           },
           (payload) => {
             clientLogger.debug('Realtime event received', {
               table,
               eventType: payload.eventType,
             })

             try {
               switch (payload.eventType) {
                 case 'INSERT':
                   onInsert?.(payload.new as T)
                   break
                 case 'UPDATE':
                   onUpdate?.({
                     old: payload.old as T,
                     new: payload.new as T,
                   })
                   break
                 case 'DELETE':
                   onDelete?.(payload.old as T)
                   break
               }
             } catch (err) {
               clientLogger.error('Error handling realtime event', {
                 table,
                 error: err instanceof Error ? err.message : 'Unknown error',
               })
               setError(err instanceof Error ? err : new Error('Unknown error'))
             }
           }
         )
         .subscribe((status) => {
           if (status === 'SUBSCRIBED') {
             clientLogger.info('Realtime subscription active', {
               table,
               channelName,
             })
             setIsConnected(true)
           } else if (status === 'CLOSED') {
             clientLogger.info('Realtime subscription closed', {
               table,
               channelName,
             })
             setIsConnected(false)
           } else if (status === 'CHANNEL_ERROR') {
             const error = new Error(`Channel error for table: ${table}`)
             clientLogger.error('Realtime subscription error', {
               table,
               channelName,
             })
             setError(error)
             setIsConnected(false)
           }
         })

       setChannel(realtimeChannel)

       // Cleanup on unmount
       return () => {
         clientLogger.debug('Cleaning up realtime subscription', {
           table,
           channelName,
         })
         realtimeChannel.unsubscribe()
       }
     }, [table, schema, JSON.stringify(filter), JSON.stringify(event)])

     return { channel, error, isConnected }
   }
   ```

2. **Create Typed Hooks for Specific Tables**
   ```typescript
   // src/hooks/useWeightLogsRealtime.ts
   'use client'

   import { useRealtimeSubscription } from './useRealtimeSubscription'

   export interface WeightLog {
     id: string
     user_id: string
     weight_kg: number
     measured_at: string
     source: string
     created_at: string
     updated_at: string
   }

   export function useWeightLogsRealtime(
     userId: string,
     onUpdate: () => void
   ) {
     return useRealtimeSubscription<WeightLog>({
       table: 'weight_logs',
       filter: { column: 'user_id', value: userId },
       onInsert: (payload) => {
         console.log('New weight log:', payload)
         onUpdate()
       },
       onUpdate: ({ new: newLog }) => {
         console.log('Weight log updated:', newLog)
         onUpdate()
       },
       onDelete: (payload) => {
         console.log('Weight log deleted:', payload)
         onUpdate()
       },
     })
   }
   ```

   ```typescript
   // src/hooks/useNutritionLogsRealtime.ts
   'use client'

   import { useRealtimeSubscription } from './useRealtimeSubscription'

   export interface NutritionLog {
     id: string
     user_id: string
     food_name: string
     calories: number
     protein_g: number | null
     carbs_g: number | null
     fat_g: number | null
     logged_at: string
     meal_type: string | null
     created_at: string
     updated_at: string
   }

   export function useNutritionLogsRealtime(
     userId: string,
     onUpdate: () => void
   ) {
     return useRealtimeSubscription<NutritionLog>({
       table: 'nutrition_logs',
       filter: { column: 'user_id', value: userId },
       onInsert: (payload) => {
         console.log('New nutrition log:', payload)
         onUpdate()
       },
       onUpdate: ({ new: newLog }) => {
         console.log('Nutrition log updated:', newLog)
         onUpdate()
       },
       onDelete: (payload) => {
         console.log('Nutrition log deleted:', payload)
         onUpdate()
       },
     })
   }
   ```

3. **Add Realtime to Dashboard**
   ```typescript
   // src/app/app/page.tsx (update)
   'use client'

   import { useEffect, useState } from 'react'
   import { useWeightLogsRealtime } from '@/hooks/useWeightLogsRealtime'
   import { useNutritionLogsRealtime } from '@/hooks/useNutritionLogsRealtime'
   import { createBrowserClient } from '@/utils/supabase/client'

   export default function DashboardPage() {
     const [user, setUser] = useState<any>(null)
     const [weightLogs, setWeightLogs] = useState([])
     const [nutritionLogs, setNutritionLogs] = useState([])
     const [refreshKey, setRefreshKey] = useState(0)

     // Fetch initial data
     useEffect(() => {
       async function fetchData() {
         const supabase = createBrowserClient()
         const { data: { user } } = await supabase.auth.getUser()

         if (user) {
           setUser(user)

           // Fetch weight logs
           const { data: weights } = await supabase
             .from('weight_logs')
             .select('*')
             .eq('user_id', user.id)
             .order('measured_at', { ascending: false })
             .limit(10)

           setWeightLogs(weights || [])

           // Fetch nutrition logs
           const { data: nutrition } = await supabase
             .from('nutrition_logs')
             .select('*')
             .eq('user_id', user.id)
             .order('logged_at', { ascending: false })
             .limit(10)

           setNutritionLogs(nutrition || [])
         }
       }

       fetchData()
     }, [refreshKey])

     // Setup realtime subscriptions
     const weightRealtimeStatus = useWeightLogsRealtime(
       user?.id || '',
       () => setRefreshKey((prev) => prev + 1)
     )

     const nutritionRealtimeStatus = useNutritionLogsRealtime(
       user?.id || '',
       () => setRefreshKey((prev) => prev + 1)
     )

     return (
       <div className="space-y-6">
         {/* Connection status indicators (dev mode only) */}
         {process.env.NODE_ENV === 'development' && (
           <div className="flex gap-2 text-xs text-muted-foreground">
             <span>
               Weight: {weightRealtimeStatus.isConnected ? '🟢' : '🔴'}
             </span>
             <span>
               Nutrition: {nutritionRealtimeStatus.isConnected ? '🟢' : '🔴'}
             </span>
           </div>
         )}

         {/* Dashboard content */}
         <WeightChart data={weightLogs} />
         <NutritionSummary data={nutritionLogs} />
       </div>
     )
   }
   ```

**Acceptance Criteria:**
- [ ] `useRealtimeSubscription` hook created and tested
- [ ] Typed hooks for weight_logs and nutrition_logs
- [ ] Dashboard updates automatically when data changes
- [ ] Connection status tracked and logged
- [ ] Proper cleanup on unmount
- [ ] No memory leaks

---

### Task 9.2: Complete Theming System

**Estimated Time:** 2 days

**Subtasks:**

1. **Audit All Files for Hardcoded Colors**
   ```bash
   # Find all hardcoded Tailwind colors
   grep -r "bg-\(blue\|red\|green\|yellow\|indigo\|purple\|pink\|gray\|slate\|zinc\)-[0-9]" src/ --include="*.tsx" --include="*.ts"

   grep -r "text-\(blue\|red\|green\|yellow\|indigo\|purple\|pink\|gray\|slate\|zinc\)-[0-9]" src/ --include="*.tsx" --include="*.ts"

   grep -r "border-\(blue\|red\|green\|yellow\|indigo\|purple\|pink\|gray\|slate\|zinc\)-[0-9]" src/ --include="*.tsx" --include="*.ts"
   ```

2. **Create Theme Color Mapping Guide**
   ```markdown
   // docs/theme-color-mapping.md

   # Theme Color Mapping Guide

   ## Background Colors

   | Hardcoded Color | Theme Variable | Usage |
   |----------------|----------------|-------|
   | `bg-white` | `bg-background` | Main background |
   | `bg-gray-50`, `bg-slate-50` | `bg-secondary/20` | Light background |
   | `bg-gray-100`, `bg-slate-100` | `bg-secondary` | Secondary background |
   | `bg-gray-200`, `bg-slate-200` | `bg-muted` | Muted background |
   | `bg-blue-50` | `bg-primary/10` | Primary light background |
   | `bg-blue-100` | `bg-primary/20` | Primary lighter background |
   | `bg-blue-500` | `bg-primary` | Primary background |
   | `bg-blue-600` | `bg-primary/90` | Primary hover |
   | `bg-red-50` | `bg-destructive/10` | Error light background |
   | `bg-red-500` | `bg-destructive` | Error background |
   | `bg-green-50` | `bg-accent/10` | Success light background |
   | `bg-green-500` | `bg-accent` | Success background |

   ## Text Colors

   | Hardcoded Color | Theme Variable | Usage |
   |----------------|----------------|-------|
   | `text-black`, `text-gray-900` | `text-foreground` | Primary text |
   | `text-gray-600`, `text-slate-600` | `text-muted-foreground` | Secondary text |
   | `text-gray-500`, `text-slate-500` | `text-muted-foreground/80` | Tertiary text |
   | `text-gray-400`, `text-slate-400` | `text-muted-foreground/60` | Placeholder text |
   | `text-blue-600` | `text-primary` | Primary colored text |
   | `text-red-600` | `text-destructive` | Error text |
   | `text-white` | `text-primary-foreground` or `text-background` | Light text on dark background |

   ## Border Colors

   | Hardcoded Color | Theme Variable | Usage |
   |----------------|----------------|-------|
   | `border-gray-200`, `border-slate-200` | `border-border` | Default border |
   | `border-gray-300`, `border-slate-300` | `border-border/80` | Emphasized border |
   | `border-blue-200` | `border-primary/30` | Primary border |
   | `border-red-200` | `border-destructive/30` | Error border |

   ## Chart Colors

   Use the chart color system for data visualizations:
   - `bg-chart-1`, `text-chart-1` - Primary chart color
   - `bg-chart-2`, `text-chart-2` - Secondary chart color
   - `bg-chart-3`, `text-chart-3` - Tertiary chart color
   - `bg-chart-4`, `text-chart-4` - Quaternary chart color
   - `bg-chart-5`, `text-chart-5` - Quinary chart color

   ## Special Cases

   ### Gradients
   ```tsx
   // BEFORE:
   className="bg-gradient-to-r from-blue-500 to-purple-600"

   // AFTER:
   className="bg-gradient-to-r from-primary to-primary/80"
   ```

   ### Shadows
   ```tsx
   // BEFORE:
   className="shadow-blue-500/50"

   // AFTER:
   className="shadow-primary/50"
   ```

   ### Opacity Variations
   ```tsx
   // Use opacity modifiers with theme colors:
   bg-primary/10  // 10% opacity
   bg-primary/20  // 20% opacity
   bg-primary/50  // 50% opacity
   bg-primary/80  // 80% opacity
   text-foreground/60 // 60% opacity text
   ```
   ```

3. **Replace Hardcoded Colors Systematically**

   **Priority Files (Complete First):**
   - `src/app/page.tsx` - Landing page
   - `src/app/login/page.tsx` - Login page
   - `src/app/app/page.tsx` - Dashboard
   - `src/components/dashboard-preview.tsx`
   - `src/components/app/navigation.tsx`

   **Example Replacements:**

   ```typescript
   // BEFORE: src/app/page.tsx
   <div className="bg-gradient-to-b from-blue-50 to-white min-h-screen">
     <div className="bg-white rounded-lg shadow-lg border border-gray-200">
       <h1 className="text-gray-900 font-bold">Welcome</h1>
       <p className="text-gray-600">Get started today</p>
       <button className="bg-blue-600 text-white hover:bg-blue-700">
         Sign Up
       </button>
     </div>
   </div>

   // AFTER: src/app/page.tsx
   <div className="bg-gradient-to-b from-secondary/20 to-background min-h-screen">
     <div className="bg-card rounded-lg shadow-lg border border-border">
       <h1 className="text-foreground font-bold">Welcome</h1>
       <p className="text-muted-foreground">Get started today</p>
       <button className="bg-primary text-primary-foreground hover:bg-primary/90">
         Sign Up
       </button>
     </div>
   </div>
   ```

4. **Update All Remaining Files**

   Create a script to help identify and track progress:
   ```bash
   #!/bin/bash
   # scripts/count-hardcoded-colors.sh

   echo "Counting hardcoded color usage..."

   BG_COUNT=$(grep -r "bg-\(blue\|red\|green\|yellow\|indigo\|purple\|pink\|gray\|slate\|zinc\)-[0-9]" src/ --include="*.tsx" --include="*.ts" | wc -l)
   TEXT_COUNT=$(grep -r "text-\(blue\|red\|green\|yellow\|indigo\|purple\|pink\|gray\|slate\|zinc\)-[0-9]" src/ --include="*.tsx" --include="*.ts" | wc -l)
   BORDER_COUNT=$(grep -r "border-\(blue\|red\|green\|yellow\|indigo\|purple\|pink\|gray\|slate\|zinc\)-[0-9]" src/ --include="*.tsx" --include="*.ts" | wc -l)

   TOTAL=$((BG_COUNT + TEXT_COUNT + BORDER_COUNT))

   echo "Background colors: $BG_COUNT"
   echo "Text colors: $TEXT_COUNT"
   echo "Border colors: $BORDER_COUNT"
   echo "TOTAL: $TOTAL"

   if [ $TOTAL -eq 0 ]; then
     echo "✅ No hardcoded colors found!"
     exit 0
   else
     echo "❌ Found $TOTAL hardcoded colors. Keep working!"
     exit 1
   fi
   ```

**Acceptance Criteria:**
- [ ] Zero hardcoded Tailwind colors in codebase
- [ ] Theme color mapping guide created
- [ ] All pages use theme variables
- [ ] Script to detect hardcoded colors passes
- [ ] Dark mode works perfectly on all pages

---

### Task 9.3: Theme Switcher Component

**Estimated Time:** 1 day

**Subtasks:**

1. **Install next-themes (already installed)**
   ```bash
   # Already in package.json
   # "next-themes": "^0.4.6"
   ```

2. **Create Theme Provider**
   ```typescript
   // src/components/providers/ThemeProvider.tsx
   'use client'

   import { ThemeProvider as NextThemesProvider } from 'next-themes'
   import { type ThemeProviderProps } from 'next-themes/dist/types'

   export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
     return <NextThemesProvider {...props}>{children}</NextThemesProvider>
   }
   ```

3. **Add Theme Provider to Layout**
   ```typescript
   // src/app/layout.tsx (update)
   import { ThemeProvider } from '@/components/providers/ThemeProvider'

   export default function RootLayout({
     children,
   }: {
     children: React.ReactNode
   }) {
     return (
       <html lang="en" suppressHydrationWarning>
         <body className={inter.className}>
           <ThemeProvider
             attribute="class"
             defaultTheme="system"
             enableSystem
             disableTransitionOnChange
           >
             {children}
           </ThemeProvider>
         </body>
       </html>
     )
   }
   ```

4. **Create Theme Switcher Component**
   ```typescript
   // src/components/ui/theme-switcher.tsx
   'use client'

   import { Moon, Sun, Monitor } from 'lucide-react'
   import { useTheme } from 'next-themes'
   import { useEffect, useState } from 'react'
   import {
     DropdownMenu,
     DropdownMenuContent,
     DropdownMenuItem,
     DropdownMenuTrigger,
   } from '@/components/ui/dropdown-menu'
   import { Button } from '@/components/ui/button'

   export function ThemeSwitcher() {
     const { theme, setTheme } = useTheme()
     const [mounted, setMounted] = useState(false)

     // Avoid hydration mismatch
     useEffect(() => {
       setMounted(true)
     }, [])

     if (!mounted) {
       return (
         <Button variant="ghost" size="icon" disabled>
           <Sun className="w-5 h-5" />
         </Button>
       )
     }

     return (
       <DropdownMenu>
         <DropdownMenuTrigger asChild>
           <Button variant="ghost" size="icon">
             {theme === 'dark' ? (
               <Moon className="w-5 h-5" />
             ) : theme === 'light' ? (
               <Sun className="w-5 h-5" />
             ) : (
               <Monitor className="w-5 h-5" />
             )}
             <span className="sr-only">Toggle theme</span>
           </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="end">
           <DropdownMenuItem onClick={() => setTheme('light')}>
             <Sun className="w-4 h-4 mr-2" />
             Light
           </DropdownMenuItem>
           <DropdownMenuItem onClick={() => setTheme('dark')}>
             <Moon className="w-4 h-4 mr-2" />
             Dark
           </DropdownMenuItem>
           <DropdownMenuItem onClick={() => setTheme('system')}>
             <Monitor className="w-4 h-4 mr-2" />
             System
           </DropdownMenuItem>
         </DropdownMenuContent>
       </DropdownMenu>
     )
   }
   ```

5. **Add Theme Switcher to Navigation**
   ```typescript
   // src/components/app/navigation.tsx (update)
   import { ThemeSwitcher } from '@/components/ui/theme-switcher'

   export function Navigation() {
     return (
       <nav className="border-b border-border bg-background">
         <div className="container mx-auto px-4">
           <div className="flex h-16 items-center justify-between">
             <div className="flex items-center gap-8">
               {/* Navigation items */}
             </div>

             <div className="flex items-center gap-4">
               <ThemeSwitcher />
               {/* Other nav items */}
             </div>
           </div>
         </div>
       </nav>
     )
   }
   ```

6. **Update Tailwind Config for Dark Mode**
   ```typescript
   // tailwind.config.ts (verify)
   import type { Config } from 'tailwindcss'

   const config: Config = {
     darkMode: 'class', // Ensure this is set
     content: [
       './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
       './src/components/**/*.{js,ts,jsx,tsx,mdx}',
       './src/app/**/*.{js,ts,jsx,tsx,mdx}',
     ],
     theme: {
       extend: {
         colors: {
           // Verify theme colors are defined
           border: 'hsl(var(--border))',
           background: 'hsl(var(--background))',
           foreground: 'hsl(var(--foreground))',
           // ... etc
         },
       },
     },
   }

   export default config
   ```

**Acceptance Criteria:**
- [ ] Theme switcher visible in navigation
- [ ] Light/dark/system modes work correctly
- [ ] Theme preference persists across sessions
- [ ] No hydration mismatches
- [ ] Smooth transitions between themes
- [ ] All pages respect theme setting

---

### Task 9.4: Responsive Breakpoint Standardization

**Estimated Time:** 1 day

**Subtasks:**

1. **Document Standard Breakpoints**
   ```markdown
   // docs/responsive-design-guide.md

   # Responsive Design Guide

   ## Standard Breakpoints

   Tailwind CSS default breakpoints (mobile-first):

   | Breakpoint | Min Width | CSS | Usage |
   |-----------|-----------|-----|-------|
   | `sm` | 640px | `@media (min-width: 640px)` | Small tablets |
   | `md` | 768px | `@media (min-width: 768px)` | Tablets |
   | `lg` | 1024px | `@media (min-width: 1024px)` | Laptops |
   | `xl` | 1280px | `@media (min-width: 1280px)` | Desktops |
   | `2xl` | 1536px | `@media (min-width: 1536px)` | Large desktops |

   ## Mobile-First Approach

   Always design for mobile first, then add breakpoints for larger screens:

   ```tsx
   // ✅ GOOD: Mobile-first
   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

   // ❌ BAD: Desktop-first
   <div className="grid grid-cols-3 lg:grid-cols-2 md:grid-cols-1">
   ```

   ## Common Patterns

   ### Container Padding
   ```tsx
   // Responsive padding
   <div className="px-4 sm:px-6 lg:px-8">
   ```

   ### Grid Layouts
   ```tsx
   // 1 column mobile, 2 tablet, 3 desktop
   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
   ```

   ### Text Sizes
   ```tsx
   // Responsive typography
   <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
   ```

   ### Spacing
   ```tsx
   // Responsive spacing
   <div className="space-y-4 lg:space-y-6">
   ```

   ### Hiding/Showing
   ```tsx
   // Hide on mobile, show on desktop
   <div className="hidden lg:block">Desktop only</div>

   // Show on mobile, hide on desktop
   <div className="lg:hidden">Mobile only</div>
   ```

   ## Testing

   Test at these specific widths:
   - 375px - iPhone SE
   - 390px - iPhone 12/13/14
   - 428px - iPhone 14 Pro Max
   - 768px - iPad portrait
   - 1024px - iPad landscape
   - 1280px - Laptop
   - 1920px - Desktop
   ```

2. **Audit and Fix Responsive Issues**

   **Priority Pages:**
   - Landing page (`src/app/page.tsx`)
   - Dashboard (`src/app/app/page.tsx`)
   - Calorie tracker (`src/app/app/calorie-tracker/page.tsx`)
   - Settings (`src/app/app/settings/page.tsx`)
   - Analytics (`src/app/app/analytics/page.tsx`)

3. **Create Responsive Testing Checklist**
   ```markdown
   // docs/responsive-testing-checklist.md

   # Responsive Testing Checklist

   ## Per Page Testing

   For each page, verify at these breakpoints:

   ### Mobile (375px - 767px)
   - [ ] All text is readable without horizontal scroll
   - [ ] Buttons and touch targets are at least 44px × 44px
   - [ ] Forms are easy to fill out
   - [ ] Navigation is accessible
   - [ ] Images scale appropriately
   - [ ] No content overflow

   ### Tablet (768px - 1023px)
   - [ ] Layout uses available space efficiently
   - [ ] Multi-column layouts appear when appropriate
   - [ ] Touch targets remain accessible
   - [ ] Charts and graphs are readable

   ### Desktop (1024px+)
   - [ ] Multi-column layouts work correctly
   - [ ] Hover states work
   - [ ] Content doesn't stretch too wide
   - [ ] Proper use of whitespace

   ## Global Components

   - [ ] Navigation works at all breakpoints
   - [ ] Footer displays correctly
   - [ ] Modals/dialogs are responsive
   - [ ] Forms adapt to screen size
   - [ ] Tables scroll or adapt on mobile
   ```

**Acceptance Criteria:**
- [ ] Responsive design guide documented
- [ ] All pages tested at standard breakpoints
- [ ] No horizontal scroll on any page
- [ ] Touch targets meet accessibility standards (44px min)
- [ ] Mobile navigation works smoothly

---

## Testing Requirements

### Unit Tests

1. **Real-time Hook Tests**
   ```typescript
   // src/hooks/__tests__/useRealtimeSubscription.test.ts
   import { renderHook, waitFor } from '@testing-library/react'
   import { useRealtimeSubscription } from '../useRealtimeSubscription'

   describe('useRealtimeSubscription', () => {
     it('should connect to realtime channel', async () => {
       const { result } = renderHook(() =>
         useRealtimeSubscription({
           table: 'weight_logs',
           onInsert: jest.fn(),
         })
       )

       await waitFor(() => {
         expect(result.current.isConnected).toBe(true)
       })
     })

     it('should cleanup on unmount', () => {
       const { unmount } = renderHook(() =>
         useRealtimeSubscription({
           table: 'weight_logs',
           onInsert: jest.fn(),
         })
       )

       unmount()
       // Verify channel.unsubscribe was called
     })
   })
   ```

2. **Theme Switcher Tests**
   ```typescript
   // src/components/ui/__tests__/theme-switcher.test.tsx
   import { render, screen, fireEvent } from '@testing-library/react'
   import { ThemeSwitcher } from '../theme-switcher'
   import { ThemeProvider } from 'next-themes'

   describe('ThemeSwitcher', () => {
     it('should render theme toggle button', () => {
       render(
         <ThemeProvider>
           <ThemeSwitcher />
         </ThemeProvider>
       )

       expect(screen.getByRole('button')).toBeInTheDocument()
     })

     it('should change theme when clicked', async () => {
       const { container } = render(
         <ThemeProvider>
           <ThemeSwitcher />
         </ThemeProvider>
       )

       const button = screen.getByRole('button')
       fireEvent.click(button)

       // Verify dropdown appears
       expect(screen.getByText('Light')).toBeInTheDocument()
       expect(screen.getByText('Dark')).toBeInTheDocument()
     })
   })
   ```

### Integration Tests

1. **Real-time Data Flow**
   - Insert weight log → Dashboard updates automatically
   - Update nutrition log → Calorie tracker refreshes
   - Delete log → UI removes entry

2. **Theme Persistence**
   - Set theme → Refresh page → Theme persists
   - System theme changes → App follows system preference
   - Switch theme → All pages update

### Manual Testing Checklist

- [ ] Real-time updates work on dashboard
- [ ] Weight log insert appears immediately
- [ ] Nutrition log update reflects instantly
- [ ] Connection indicators show correct status
- [ ] Theme switcher accessible in navigation
- [ ] Light mode displays correctly on all pages
- [ ] Dark mode displays correctly on all pages
- [ ] System theme preference respected
- [ ] Theme persists across browser sessions
- [ ] No hardcoded colors visible in any theme
- [ ] All pages responsive at 375px, 768px, 1024px, 1920px
- [ ] No horizontal scroll on mobile
- [ ] Touch targets meet 44px minimum

---

## Success Metrics

### Real-time Functionality
- ✅ Dashboard updates within 1 second of data change
- ✅ Connection status tracked and logged
- ✅ No memory leaks from subscriptions
- ✅ Graceful handling of connection errors

### Theming
- ✅ Zero hardcoded Tailwind colors in codebase
- ✅ Perfect dark mode on all pages
- ✅ Theme switcher in navigation
- ✅ Theme preference persists
- ✅ No flash of unstyled content (FOUC)

### Responsive Design
- ✅ All pages work at 375px width
- ✅ Touch targets ≥ 44px on mobile
- ✅ No horizontal scroll on any device
- ✅ Optimal use of space at all breakpoints

### Performance
- ✅ Theme switching is instant
- ✅ Real-time subscriptions don't impact page load
- ✅ No layout shift when theme loads

---

## Dependencies & Blockers

**Dependencies:**
- Phase 8 must be complete (foundation cleanup)
- `next-themes` package (already installed)
- Supabase real-time enabled (verify in dashboard)

**Potential Blockers:**
- Supabase real-time rate limits on free tier
- Large number of files to update for theming
- Complex components with deeply nested color usage

---

## Rollout Plan

### Day 1: Real-time Foundation
- Morning: Create `useRealtimeSubscription` hook
- Afternoon: Create typed hooks for weight_logs and nutrition_logs
- End of day: Add real-time to dashboard

### Day 2: Theme Mapping & Critical Pages
- Morning: Create theme color mapping guide
- Afternoon: Fix landing page and login page
- End of day: Fix dashboard and navigation

### Day 3: Complete Theming
- Morning: Systematically fix remaining components
- Afternoon: Continue component theming
- End of day: Run color audit script (should pass)

### Day 4: Theme Switcher & Testing
- Morning: Create theme switcher component
- Afternoon: Add to navigation, test persistence
- End of day: Test theme across all pages

### Day 5: Responsive & Polish
- Morning: Document responsive patterns
- Afternoon: Fix responsive issues on priority pages
- End of day: Full testing and documentation review

---

## Risk Mitigation

### Risk: Real-time Performance Issues
**Impact:** High
**Likelihood:** Medium
**Mitigation:**
- Implement connection pooling
- Add debouncing for rapid updates
- Monitor connection count
- Implement fallback to polling if needed

### Risk: Theme Migration Breaking UI
**Impact:** Medium
**Likelihood:** Medium
**Mitigation:**
- Work file-by-file with git commits
- Test each page after updates
- Keep color mapping guide handy
- Use automation script to catch regressions

### Risk: Too Many Files to Update
**Impact:** Low
**Likelihood:** High
**Mitigation:**
- Prioritize user-facing pages first
- Can defer admin/internal pages if needed
- Use find/replace carefully
- Split work across multiple PRs if needed

---

## Appendix A: Files to Modify

### Files to Create
- [ ] `src/hooks/useRealtimeSubscription.ts`
- [ ] `src/hooks/useWeightLogsRealtime.ts`
- [ ] `src/hooks/useNutritionLogsRealtime.ts`
- [ ] `src/hooks/useMoodLogsRealtime.ts`
- [ ] `src/components/providers/ThemeProvider.tsx`
- [ ] `src/components/ui/theme-switcher.tsx`
- [ ] `docs/theme-color-mapping.md`
- [ ] `docs/responsive-design-guide.md`
- [ ] `docs/responsive-testing-checklist.md`
- [ ] `scripts/count-hardcoded-colors.sh`

### Files to Modify (Theme Colors)
- [ ] `src/app/page.tsx`
- [ ] `src/app/login/page.tsx`
- [ ] `src/app/app/page.tsx`
- [ ] `src/app/app/calorie-tracker/page.tsx`
- [ ] `src/app/app/settings/page.tsx`
- [ ] `src/app/app/analytics/page.tsx`
- [ ] `src/components/dashboard-preview.tsx`
- [ ] `src/components/app/navigation.tsx`
- [ ] `src/components/calorie-tracker/*.tsx` (all files)
- [ ] `src/components/settings/*.tsx` (all files)
- [ ] `src/components/analytics/*.tsx` (all files)
- [ ] All other component files with hardcoded colors

### Files to Modify (Real-time)
- [ ] `src/app/app/page.tsx` (add real-time subscriptions)
- [ ] `src/app/app/calorie-tracker/page.tsx` (add real-time)
- [ ] `src/app/layout.tsx` (add ThemeProvider)

---

## Change Log

**Version 1.0 - January 2025**
- Initial Phase 9 technical specification
- Detailed real-time implementation
- Complete theming migration plan
- Responsive design standardization