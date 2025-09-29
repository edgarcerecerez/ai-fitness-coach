# Phase 8: Foundation Cleanup & Architecture

**Timeline:** 2 weeks
**Priority:** CRITICAL
**Status:** Not Started
**Dependencies:** None (blocking Phase 9-16)

---

## Overview

Phase 8 focuses on fixing critical architectural issues that must be resolved before building new features. This phase establishes clean patterns, proper security, consistent logging, and removes technical debt that could cause problems later.

**Goal:** Create a solid, maintainable foundation for the remaining development work.

---

## Objectives

1. **Fix Authentication Flow Confusion**
   - Remove duplicate profile routes
   - Consolidate all user pages under `/app/*`
   - Ensure consistent auth middleware

2. **Implement Shared API Middleware**
   - Create reusable auth middleware
   - Add request validation layer
   - Standardize error responses

3. **Add Error Boundaries**
   - Root level error boundary
   - Layout level boundaries
   - Component level where needed

4. **Standardize Logging Strategy**
   - Remove all `console.log` statements
   - Enforce structured logging
   - Add ESLint rules

5. **Fix Critical Hardcoded Colors**
   - Landing page theming
   - Login page theming
   - Profile page theming

6. **Consolidate Component Patterns**
   - Define client vs server component guidelines
   - Establish loading state patterns
   - Standardize form patterns

---

## Task Breakdown

### Task 8.1: Authentication Flow Cleanup

**Estimated Time:** 2 days

**Subtasks:**

1. **Remove Legacy Profile Route**
   ```bash
   # Files to modify/remove:
   - DELETE: src/app/profile/page.tsx
   - DELETE: src/app/profile/__tests__/page.test.tsx
   - UPDATE: Any links pointing to /profile
   ```

2. **Verify `/app/profile` Implementation**
   - Ensure `/app/app/profile/page.tsx` has all functionality
   - Migrate any unique features from legacy profile
   - Update tests

3. **Add Middleware Auth Guards**
   ```typescript
   // src/middleware.ts (update/create)
   import { createMiddlewareClient } from '@/utils/supabase/middleware'
   import { NextResponse } from 'next/server'
   import type { NextRequest } from 'next/server'

   export async function middleware(req: NextRequest) {
     const res = NextResponse.next()
     const supabase = createMiddlewareClient({ req, res })

     const {
       data: { user },
     } = await supabase.auth.getUser()

     // Protected routes
     if (req.nextUrl.pathname.startsWith('/app') && !user) {
       return NextResponse.redirect(new URL('/login', req.url))
     }

     // Redirect logged-in users away from login
     if (req.nextUrl.pathname === '/login' && user) {
       return NextResponse.redirect(new URL('/app', req.url))
     }

     return res
   }

   export const config = {
     matcher: ['/app/:path*', '/login', '/profile']
   }
   ```

4. **Update All Links**
   - Search codebase for `/profile` links
   - Update to `/app/profile`
   - Test all navigation paths

**Acceptance Criteria:**
- [ ] No `/profile` route exists
- [ ] All functionality consolidated in `/app/profile`
- [ ] Middleware redirects work correctly
- [ ] All tests pass

---

### Task 8.2: Shared API Middleware

**Estimated Time:** 3 days

**Subtasks:**

1. **Create API Middleware Utilities**
   ```typescript
   // src/lib/api/middleware.ts
   import { createRouteHandlerClient } from '@/utils/supabase/server'
   import { NextRequest, NextResponse } from 'next/server'
   import { cookies } from 'next/headers'
   import { apiLogger } from '@/lib/logger'

   export type AuthenticatedRequest = NextRequest & {
     user: {
       id: string
       email: string
     }
   }

   export type RouteHandler<T = any> = (
     req: AuthenticatedRequest,
     context: any
   ) => Promise<NextResponse<T>>

   /**
    * Middleware wrapper for authenticated API routes
    */
   export function withAuth(handler: RouteHandler) {
     return async (req: NextRequest, context: any) => {
       try {
         const supabase = createRouteHandlerClient({ cookies })
         const {
           data: { user },
           error,
         } = await supabase.auth.getUser()

         if (error || !user) {
           apiLogger.warn('Unauthorized API access attempt', {
             path: req.nextUrl.pathname,
             error: error?.message,
           })

           return NextResponse.json(
             { error: 'Unauthorized' },
             { status: 401 }
           )
         }

         // Add user to request
         const authReq = req as AuthenticatedRequest
         authReq.user = {
           id: user.id,
           email: user.email!,
         }

         return await handler(authReq, context)
       } catch (error) {
         apiLogger.error('API middleware error', {
           path: req.nextUrl.pathname,
           error: error instanceof Error ? error.message : 'Unknown error',
         })

         return NextResponse.json(
           { error: 'Internal server error' },
           { status: 500 }
         )
       }
     }
   }

   /**
    * Middleware wrapper for error handling
    */
   export function withErrorHandler(handler: RouteHandler) {
     return async (req: NextRequest, context: any) => {
       try {
         return await handler(req as AuthenticatedRequest, context)
       } catch (error) {
         apiLogger.error('API route error', {
           path: req.nextUrl.pathname,
           error: error instanceof Error ? error.message : 'Unknown error',
           stack: error instanceof Error ? error.stack : undefined,
         })

         return NextResponse.json(
           { error: 'Internal server error' },
           { status: 500 }
         )
       }
     }
   }

   /**
    * Compose multiple middleware
    */
   export function compose(...middleware: Array<(handler: RouteHandler) => RouteHandler>) {
     return (handler: RouteHandler) => {
       return middleware.reduceRight((acc, mw) => mw(acc), handler)
     }
   }
   ```

2. **Create Standard Error Response Types**
   ```typescript
   // src/lib/api/responses.ts
   import { NextResponse } from 'next/server'

   export type ApiError = {
     error: string
     details?: any
   }

   export type ApiSuccess<T = any> = {
     data: T
     message?: string
   }

   export function successResponse<T>(data: T, message?: string, status = 200) {
     return NextResponse.json<ApiSuccess<T>>(
       { data, message },
       { status }
     )
   }

   export function errorResponse(error: string, details?: any, status = 400) {
     return NextResponse.json<ApiError>(
       { error, details },
       { status }
     )
   }

   export function unauthorizedResponse() {
     return errorResponse('Unauthorized', undefined, 401)
   }

   export function forbiddenResponse() {
     return errorResponse('Forbidden', undefined, 403)
   }

   export function notFoundResponse(resource = 'Resource') {
     return errorResponse(`${resource} not found`, undefined, 404)
   }

   export function validationErrorResponse(errors: any) {
     return errorResponse('Validation failed', errors, 422)
   }

   export function serverErrorResponse(error?: string) {
     return errorResponse(
       error || 'Internal server error',
       undefined,
       500
     )
   }
   ```

3. **Refactor Existing API Routes**
   - Update Withings integration endpoints
   - Update nutrition upload endpoint
   - Update Inngest endpoint (if needed)

   **Example Refactor:**
   ```typescript
   // BEFORE: src/app/api/integrations/withings/devices/route.ts
   export async function GET(request: Request) {
     const supabase = createRouteHandlerClient({ cookies })
     const { data: { user } } = await supabase.auth.getUser()

     if (!user) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
     }

     try {
       const devices = await deviceManager.getUserDevices(user.id)
       return NextResponse.json({ data: devices })
     } catch (error) {
       return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 })
     }
   }

   // AFTER: src/app/api/integrations/withings/devices/route.ts
   import { withAuth } from '@/lib/api/middleware'
   import { successResponse, serverErrorResponse } from '@/lib/api/responses'
   import { deviceManager } from '@/lib/withings/device-manager'

   export const GET = withAuth(async (req) => {
     try {
       const devices = await deviceManager.getUserDevices(req.user.id)
       return successResponse(devices)
     } catch (error) {
       return serverErrorResponse('Failed to fetch devices')
     }
   })
   ```

4. **Add Request Validation (Zod) - Foundation Only**
   ```bash
   npm install zod
   ```

   ```typescript
   // src/lib/api/validation.ts
   import { z } from 'zod'
   import { NextRequest } from 'next/server'
   import { validationErrorResponse } from './responses'

   export async function validateRequest<T extends z.ZodType>(
     req: NextRequest,
     schema: T
   ): Promise<{ success: true; data: z.infer<T> } | { success: false; response: Response }> {
     try {
       const body = await req.json()
       const parsed = schema.parse(body)
       return { success: true, data: parsed }
     } catch (error) {
       if (error instanceof z.ZodError) {
         return {
           success: false,
           response: validationErrorResponse(error.errors),
         }
       }
       return {
         success: false,
         response: validationErrorResponse('Invalid request body'),
       }
     }
   }

   // Example usage:
   // const validation = await validateRequest(req, exportSchema)
   // if (!validation.success) return validation.response
   // const { exportType, format } = validation.data
   ```

**Acceptance Criteria:**
- [ ] `withAuth` middleware created and tested
- [ ] Standard response functions created
- [ ] At least 5 API routes refactored
- [ ] Error handling consistent across routes
- [ ] Tests for middleware

---

### Task 8.3: Error Boundaries

**Estimated Time:** 2 days

**Subtasks:**

1. **Create Root Error Boundary**
   ```typescript
   // src/app/error.tsx
   'use client'

   import { useEffect } from 'react'
   import { Button } from '@/components/ui/button'
   import { AlertCircle } from 'lucide-react'
   import { clientLogger } from '@/lib/logger'

   export default function Error({
     error,
     reset,
   }: {
     error: Error & { digest?: string }
     reset: () => void
   }) {
     useEffect(() => {
       clientLogger.error('Root error boundary caught error', {
         message: error.message,
         digest: error.digest,
       })
     }, [error])

     return (
       <div className="min-h-screen flex items-center justify-center bg-background">
         <div className="max-w-md w-full p-6">
           <div className="flex flex-col items-center text-center space-y-4">
             <AlertCircle className="w-16 h-16 text-destructive" />
             <h1 className="text-2xl font-bold text-foreground">
               Something went wrong
             </h1>
             <p className="text-muted-foreground">
               We're sorry, but something unexpected happened. Our team has been notified.
             </p>
             <div className="flex gap-4 mt-6">
               <Button onClick={reset}>Try again</Button>
               <Button variant="outline" onClick={() => window.location.href = '/'}>
                 Go home
               </Button>
             </div>
           </div>
         </div>
       </div>
     )
   }
   ```

2. **Create App Layout Error Boundary**
   ```typescript
   // src/app/app/error.tsx
   'use client'

   import { useEffect } from 'react'
   import { Button } from '@/components/ui/button'
   import { AlertTriangle } from 'lucide-react'
   import { clientLogger } from '@/lib/logger'
   import Link from 'next/link'

   export default function AppError({
     error,
     reset,
   }: {
     error: Error & { digest?: string }
     reset: () => void
   }) {
     useEffect(() => {
       clientLogger.error('App error boundary caught error', {
         message: error.message,
         digest: error.digest,
       })
     }, [error])

     return (
       <div className="flex items-center justify-center min-h-[60vh]">
         <div className="max-w-md w-full p-6 text-center space-y-4">
           <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
           <h2 className="text-xl font-semibold text-foreground">
             Page Error
           </h2>
           <p className="text-muted-foreground">
             This page encountered an error. Please try refreshing or return to the dashboard.
           </p>
           <div className="flex gap-4 justify-center mt-6">
             <Button onClick={reset}>Refresh</Button>
             <Button variant="outline" asChild>
               <Link href="/app">Dashboard</Link>
             </Button>
           </div>
         </div>
       </div>
     )
   }
   ```

3. **Create Loading States**
   ```typescript
   // src/app/app/loading.tsx
   import { Skeleton } from '@/components/ui/skeleton'
   import { Card, CardContent, CardHeader } from '@/components/ui/card'

   export default function AppLoading() {
     return (
       <div className="space-y-6">
         <Skeleton className="h-8 w-64" />
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {[1, 2, 3, 4, 5, 6].map((i) => (
             <Card key={i}>
               <CardHeader>
                 <Skeleton className="h-4 w-32" />
               </CardHeader>
               <CardContent>
                 <Skeleton className="h-24 w-full" />
               </CardContent>
             </Card>
           ))}
         </div>
       </div>
     )
   }
   ```

4. **Create Not Found Page**
   ```typescript
   // src/app/not-found.tsx
   import { Button } from '@/components/ui/button'
   import { FileQuestion } from 'lucide-react'
   import Link from 'next/link'

   export default function NotFound() {
     return (
       <div className="min-h-screen flex items-center justify-center bg-background">
         <div className="max-w-md w-full p-6 text-center space-y-4">
           <FileQuestion className="w-16 h-16 text-muted-foreground mx-auto" />
           <h1 className="text-4xl font-bold text-foreground">404</h1>
           <h2 className="text-xl font-semibold text-foreground">
             Page Not Found
           </h2>
           <p className="text-muted-foreground">
             The page you're looking for doesn't exist or has been moved.
           </p>
           <Button asChild className="mt-6">
             <Link href="/">Go Home</Link>
           </Button>
         </div>
       </div>
     )
   }
   ```

**Acceptance Criteria:**
- [ ] Root error boundary catches all errors
- [ ] App layout error boundary for `/app/*` routes
- [ ] Loading states for all main routes
- [ ] Custom 404 page
- [ ] All errors logged properly

---

### Task 8.4: Standardize Logging

**Estimated Time:** 2 days

**Subtasks:**

1. **Remove All Console.log**
   ```bash
   # Find all console.log usage
   grep -r "console\.log" src/

   # Find all console.error usage
   grep -r "console\.error" src/

   # Find all console.warn usage
   grep -r "console\.warn" src/
   ```

   **Files to Update:**
   - Withings webhook processor
   - Notification service
   - Device manager
   - Any other files with console statements

2. **Add ESLint Rule**
   ```json
   // .eslintrc.json (update)
   {
     "rules": {
       "no-console": ["error", { "allow": [] }]
     }
   }
   ```

3. **Standardize Logger Usage**
   ```typescript
   // BEFORE:
   console.log('Processing webhook', webhookData)

   // AFTER:
   apiLogger.info('Processing webhook', {
     userId: webhookData.userId,
     eventType: webhookData.eventType,
   })
   ```

4. **Create Logger Usage Guidelines Document**
   ```markdown
   // docs/logging-guidelines.md

   # Logging Guidelines

   ## When to Log

   ### DEBUG Level
   - Function entry/exit (verbose)
   - Variable states during debugging
   - Development-only information

   ### INFO Level
   - Successful operations
   - Important state changes
   - User actions
   - External API calls

   ### WARN Level
   - Deprecated feature usage
   - Fallback to default values
   - Retrying operations
   - Non-critical errors

   ### ERROR Level
   - Exceptions
   - Failed operations
   - Data integrity issues
   - Security-related issues

   ## Examples

   // Good:
   apiLogger.info('User logged in', { userId, email })

   // Bad:
   console.log('User logged in:', userId, email)

   ## Context Objects

   Always include relevant context:
   - User ID (if available)
   - Operation type
   - Resource IDs
   - Error details

   // Good:
   dbLogger.error('Failed to update user profile', {
     userId,
     error: error.message,
     operation: 'updateProfile',
   })

   // Bad:
   console.error('Error:', error)
   ```

**Acceptance Criteria:**
- [ ] Zero `console.log` statements in codebase
- [ ] ESLint rule enforced
- [ ] All logging uses structured logger
- [ ] Logging guidelines documented
- [ ] CI/CD fails on console.log

---

### Task 8.5: Fix Critical Hardcoded Colors

**Estimated Time:** 2 days

**Subtasks:**

1. **Landing Page (`src/app/page.tsx`)**

   **Replace:**
   - `bg-blue-50` → `bg-secondary/20`
   - `text-slate-200` → `text-muted-foreground`
   - `bg-white` → `bg-card`
   - `border-blue-200` → `border-primary/20`
   - `from-blue-50 to-indigo-100` → `from-background to-secondary`

2. **Login Page (`src/app/login/page.tsx`)**

   **Replace:**
   - `bg-black/40` → `bg-background/90`
   - `text-white/90` → `text-foreground`
   - Maintain glass effect but use theme variables

3. **Legacy Profile Page (if not deleted yet)**

   This will be deleted in Task 8.1, but if needed:
   - Full theme color replacement
   - Use semantic colors only

4. **Create ESLint Rule (Custom)**
   ```javascript
   // .eslintrc.js (or create eslint-local-rules.js)
   module.exports = {
     rules: {
       'no-hardcoded-colors': {
         create: function(context) {
           const hardcodedColorPattern = /(bg|text|border)-(red|blue|green|yellow|indigo|purple|pink|gray|slate|zinc)-(50|100|200|300|400|500|600|700|800|900)/

           return {
             Literal(node) {
               if (typeof node.value === 'string' && hardcodedColorPattern.test(node.value)) {
                 context.report({
                   node,
                   message: 'Hardcoded Tailwind colors are not allowed. Use theme colors instead.',
                 })
               }
             }
           }
         }
       }
     }
   }
   ```

**Acceptance Criteria:**
- [ ] Landing page uses only theme colors
- [ ] Login page uses only theme colors
- [ ] Legacy profile deleted or theme-compliant
- [ ] ESLint rule prevents new hardcoded colors
- [ ] Dark mode works perfectly on these pages

---

### Task 8.6: Component Pattern Documentation

**Estimated Time:** 1 day

**Subtasks:**

1. **Create Component Patterns Document**
   ```markdown
   // docs/component-patterns.md

   # Component Patterns

   ## Client vs Server Components

   ### Use Server Components When:
   - Fetching data from database
   - Accessing server-only resources
   - No interactivity needed
   - SEO is important

   ### Use Client Components When:
   - Using React hooks (useState, useEffect, etc.)
   - Event listeners needed
   - Browser APIs required
   - Using third-party interactive libraries

   ## Examples

   ### Server Component (Default)
   ```tsx
   // No 'use client' directive
   import { createServerClient } from '@/utils/supabase/server'

   export default async function ProfilePage() {
     const supabase = createServerClient()
     const { data } = await supabase.from('user_profiles').select()

     return <div>{data?.name}</div>
   }
   ```

   ### Client Component
   ```tsx
   'use client'

   import { useState } from 'react'
   import { Button } from '@/components/ui/button'

   export function Counter() {
     const [count, setCount] = useState(0)

     return (
       <Button onClick={() => setCount(count + 1)}>
         Count: {count}
       </Button>
     )
   }
   ```

   ### Hybrid Pattern (Composition)
   ```tsx
   // page.tsx (Server Component)
   import { ClientInteractive } from './client-interactive'

   export default async function Page() {
     const data = await fetchData()

     return (
       <div>
         <h1>Server-Rendered Title</h1>
         <ClientInteractive initialData={data} />
       </div>
     )
   }

   // client-interactive.tsx (Client Component)
   'use client'

   export function ClientInteractive({ initialData }) {
     const [data, setData] = useState(initialData)
     // Interactive logic...
   }
   ```

   ## Loading States

   ### Skeleton Pattern (Preferred)
   ```tsx
   import { Skeleton } from '@/components/ui/skeleton'

   <Card>
     <CardHeader>
       <Skeleton className="h-4 w-32" />
     </CardHeader>
     <CardContent>
       <Skeleton className="h-24 w-full" />
     </CardContent>
   </Card>
   ```

   ### Spinner Pattern (Loading Actions)
   ```tsx
   import { Loader2 } from 'lucide-react'

   {loading && <Loader2 className="w-4 h-4 animate-spin" />}
   ```

   ## Form Patterns

   ### Basic Form with shadcn/ui
   ```tsx
   'use client'

   import { useState } from 'react'
   import { Button } from '@/components/ui/button'
   import { Input } from '@/components/ui/input'
   import { Label } from '@/components/ui/label'

   export function MyForm() {
     const [loading, setLoading] = useState(false)

     async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
       e.preventDefault()
       setLoading(true)

       try {
         // Handle submission
       } finally {
         setLoading(false)
       }
     }

     return (
       <form onSubmit={onSubmit} className="space-y-4">
         <div>
           <Label htmlFor="name">Name</Label>
           <Input id="name" required />
         </div>
         <Button type="submit" disabled={loading}>
           {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
           Submit
         </Button>
       </form>
     )
   }
   ```
   ```

2. **Update CLAUDE.md with Patterns**
   - Add reference to component-patterns.md
   - Include key guidelines in CLAUDE.md

**Acceptance Criteria:**
- [ ] Component patterns documented
- [ ] Server vs client guidelines clear
- [ ] Loading state patterns documented
- [ ] Form patterns documented
- [ ] CLAUDE.md updated

---

## Testing Requirements

### Unit Tests

1. **API Middleware Tests**
   ```typescript
   // src/lib/api/__tests__/middleware.test.ts
   import { withAuth } from '../middleware'
   import { NextRequest, NextResponse } from 'next/server'

   describe('withAuth middleware', () => {
     it('should reject unauthenticated requests', async () => {
       // Mock unauthenticated request
       const response = await withAuth(handler)(mockRequest, {})
       expect(response.status).toBe(401)
     })

     it('should allow authenticated requests', async () => {
       // Mock authenticated request
       const response = await withAuth(handler)(mockRequest, {})
       expect(response.status).toBe(200)
     })
   })
   ```

2. **Error Boundary Tests**
   ```typescript
   // src/app/__tests__/error.test.tsx
   import { render, screen } from '@testing-library/react'
   import Error from '../error'

   describe('Error Boundary', () => {
     it('should render error UI', () => {
       const error = new Error('Test error')
       render(<Error error={error} reset={() => {}} />)

       expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
     })

     it('should call reset function', () => {
       const reset = jest.fn()
       render(<Error error={new Error()} reset={reset} />)

       screen.getByText(/try again/i).click()
       expect(reset).toHaveBeenCalled()
     })
   })
   ```

### Integration Tests

1. **Authentication Flow**
   - Login redirects to `/app` when successful
   - `/app/*` routes redirect to `/login` when unauthenticated
   - Middleware properly handles all cases

2. **Error Handling**
   - Errors are caught by boundaries
   - Errors are logged properly
   - Users see appropriate error messages

### Manual Testing Checklist

- [ ] Unauthenticated user cannot access `/app/*`
- [ ] Authenticated user redirected from `/login` to `/app`
- [ ] Error boundaries catch and display errors
- [ ] Loading states appear during data fetching
- [ ] 404 page shows for invalid routes
- [ ] No console.log in browser console (production mode)
- [ ] Dark mode works on all updated pages
- [ ] API routes return standard response format

---

## Success Metrics

### Code Quality
- ✅ Zero `console.log` statements
- ✅ Zero hardcoded Tailwind colors (landing, login, profile)
- ✅ 100% of API routes use middleware
- ✅ Error boundaries on all layouts
- ✅ ESLint passes with new rules

### Security
- ✅ All `/app/*` routes protected by middleware
- ✅ No duplicate authentication logic
- ✅ Consistent error responses (no data leakage)

### Developer Experience
- ✅ Clear component patterns documented
- ✅ Consistent logging across codebase
- ✅ Reusable API middleware
- ✅ Easy to add new protected routes

### User Experience
- ✅ Proper error messages shown
- ✅ Loading states during navigation
- ✅ 404 page for invalid URLs
- ✅ Perfect dark mode on critical pages

---

## Dependencies

**None** - This phase can start immediately

**Blocks:**
- Phase 9 (depends on theming foundation)
- Phase 10 (depends on component patterns)
- All other phases (foundation must be solid)

---

## Rollout Plan

### Week 1
**Days 1-2:** Task 8.1 (Authentication cleanup)
**Days 3-5:** Task 8.2 (API middleware)

### Week 2
**Days 6-7:** Task 8.3 (Error boundaries)
**Days 8-9:** Task 8.4 (Logging standardization)
**Day 10:** Task 8.5 (Critical hardcoded colors)

**Final Day:** Task 8.6 (Documentation) + Testing + Review

---

## Risks & Mitigation

### Risk: Breaking Existing Functionality
**Mitigation:**
- Comprehensive testing before each commit
- Feature flags for major changes
- Gradual rollout of API middleware

### Risk: Team Confusion on New Patterns
**Mitigation:**
- Clear documentation
- Code review enforcement
- Pair programming for first implementations

### Risk: Time Overrun on API Refactoring
**Mitigation:**
- Prioritize most-used routes first
- Can defer less-used routes to Phase 14
- Parallel work where possible

---

## Next Steps

After Phase 8 completion:
1. **Code Review** - Full team review of changes
2. **Staging Deployment** - Deploy to staging environment
3. **Testing** - Full regression testing
4. **Documentation Review** - Ensure all docs are updated
5. **Begin Phase 9** - Real-time and theming implementation

---

## Appendix A: File Checklist

### Files to Create
- [ ] `src/lib/api/middleware.ts`
- [ ] `src/lib/api/responses.ts`
- [ ] `src/lib/api/validation.ts`
- [ ] `src/app/error.tsx`
- [ ] `src/app/app/error.tsx`
- [ ] `src/app/app/loading.tsx`
- [ ] `src/app/not-found.tsx`
- [ ] `docs/component-patterns.md`
- [ ] `docs/logging-guidelines.md`

### Files to Delete
- [ ] `src/app/profile/page.tsx`
- [ ] `src/app/profile/__tests__/page.test.tsx`

### Files to Modify
- [ ] `src/app/page.tsx` (theming)
- [ ] `src/app/login/page.tsx` (theming)
- [ ] `src/middleware.ts` (auth guards)
- [ ] `.eslintrc.json` (new rules)
- [ ] All Withings API routes (middleware)
- [ ] `CLAUDE.md` (add patterns reference)
- [ ] All files with `console.log`

---

## Change Log

**Version 1.0 - January 2025**
- Initial Phase 8 technical specification
- Detailed task breakdown with code examples
- Testing requirements
- Success metrics and rollout plan