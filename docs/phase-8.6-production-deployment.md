# Phase 8.6: Production Deployment - Technical Implementation

## Summary

**Goal**: Final optimizations, monitoring setup, security audit, and production launch.

**Priority**: 🟢 MEDIUM
**Duration**: Week 6 (36-48 hours)
**Dependencies**: Phases 8.1-8.5 (all features, tests, and quality checks must be complete)

### What We're Achieving

This phase prepares the application for production launch with enterprise-grade monitoring and optimization:

1. **Performance Optimization** - Bundle analysis, code splitting, image optimization
2. **Monitoring & Error Tracking** - Sentry integration, analytics, uptime monitoring
3. **Security Audit** - Environment variables, API security, RLS policies, CSP headers
4. **Documentation** - Deployment guide, API docs, environment setup, user guide
5. **Production Launch** - Pre-launch checklist, deployment, post-launch monitoring

**Impact**: Production-ready application with monitoring, security, and performance optimizations.

### Success Criteria

- [ ] Lighthouse score ≥90 (mobile and desktop)
- [ ] Bundle size optimized (<500KB initial JS)
- [ ] Sentry integrated and capturing errors
- [ ] Security headers configured
- [ ] All environment variables documented
- [ ] Deployment documentation complete
- [ ] Production deployment successful
- [ ] Post-launch monitoring active

---

## Technical Implementation

### Task 8.6.1: Performance Optimization

**Problem**: Need to ensure optimal performance for production.

**Goals**:
- Lighthouse score ≥90
- First Contentful Paint <1.5s
- Time to Interactive <3.5s
- Total Blocking Time <200ms
- Bundle size <500KB

#### Step 1: Bundle Analysis

**File**: `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Image optimization
  images: {
    domains: [
      'supabase.co',
      'your-storage-domain.supabase.co',
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Compression
  compress: true,

  // Output tracing for bundle analysis
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'recharts',
    ],
  },

  // Environment variables validation
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version,
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);
```

**Run bundle analyzer**:

```bash
ANALYZE=true npm run build
```

This opens an interactive treemap showing bundle composition.

#### Step 2: Code Splitting

**File**: `src/app/app/analytics/page.tsx`

```typescript
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Dynamically import heavy chart components
const WeightChart = dynamic(() => import('@/components/analytics/weight-chart'), {
  loading: () => <Skeleton className="w-full h-[300px]" />,
  ssr: false, // Don't render charts on server
});

const CalorieChart = dynamic(() => import('@/components/analytics/calorie-chart'), {
  loading: () => <Skeleton className="w-full h-[300px]" />,
  ssr: false,
});

const TrendAnalysis = dynamic(() => import('@/components/analytics/trend-analysis'), {
  loading: () => <Skeleton className="w-full h-[200px]" />,
  ssr: false,
});

export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Analytics</h1>

      {/* Charts load dynamically, reducing initial bundle */}
      <WeightChart />
      <CalorieChart />
      <TrendAnalysis />
    </div>
  );
}
```

**Apply to all pages with heavy components**:
- Analytics page (charts)
- Calorie tracker (camera component)
- Settings (Withings components)

#### Step 3: Image Optimization

**File**: `src/components/calorie-tracker/meal-image.tsx`

```typescript
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface MealImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

export function MealImage({ src, alt, className, priority = false }: MealImageProps) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className="object-cover"
        priority={priority}
        quality={85}
        placeholder="blur"
        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDABQODxIPDRQSEBIXFRQdHx4eHRoaHSQtJSEkLzYvLy02LzYvLTExMjIxMTIxMjIxMjIxMjIxMjIxMjIxMjIxMTH/2wBDAR"
      />
    </div>
  );
}
```

**Update all image usages** to use Next.js Image component.

#### Step 4: Font Optimization

**File**: `src/app/layout.tsx`

```typescript
import { Inter } from 'next/font/google';

// Optimize font loading
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
  fallback: ['system-ui', 'arial'],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
```

#### Step 5: Lighthouse CI Configuration

**File**: `.lighthouserc.js`

```javascript
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/', 'http://localhost:3000/login', 'http://localhost:3000/app'],
      numberOfRuns: 3,
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 1500 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

**Add to package.json**:

```json
{
  "scripts": {
    "lighthouse": "lhci autorun",
    "lighthouse:open": "lhci open"
  },
  "devDependencies": {
    "@lhci/cli": "^0.13.0"
  }
}
```

**Run Lighthouse CI**:

```bash
npm install -D @lhci/cli
npm run build
npm run start &
npm run lighthouse
```

---

### Task 8.6.2: Monitoring & Error Tracking

**Problem**: Need visibility into production errors and performance.

**Solution**: Integrate Sentry, Vercel Analytics, and custom event tracking.

#### Step 1: Sentry Setup

**Install Sentry**:

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

**File**: `sentry.client.config.ts`

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Environment
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,

  // User context
  beforeSend(event, hint) {
    // Don't send events in development
    if (process.env.NODE_ENV === 'development') {
      return null;
    }

    // Scrub sensitive data
    if (event.request) {
      delete event.request.cookies;
    }

    return event;
  },

  // Ignore common errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    'cancelled',
  ],

  // Filter integrations
  integrations: [
    new Sentry.BrowserTracing({
      // Only trace important routes
      tracePropagationTargets: ['localhost', /^https:\/\/yourapp\.com/],
    }),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
```

**File**: `sentry.server.config.ts`

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,

  beforeSend(event) {
    // Scrub sensitive data
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;
    }

    return event;
  },
});
```

**File**: `sentry.edge.config.ts`

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});
```

**Update error handling to use Sentry**:

**File**: `src/lib/errors.ts`

```typescript
import * as Sentry from '@sentry/nextjs';

export function captureError(error: unknown, context?: Record<string, any>) {
  console.error('Error captured:', error);

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

export function setUserContext(user: { id: string; email?: string }) {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    Sentry.setUser({
      id: user.id,
      email: user.email,
    });
  }
}

export function clearUserContext() {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    Sentry.setUser(null);
  }
}
```

#### Step 2: Vercel Analytics

**Install Vercel Analytics**:

```bash
npm install @vercel/analytics
```

**File**: `src/app/layout.tsx`

```typescript
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

#### Step 3: Custom Event Tracking

**File**: `src/lib/analytics.ts`

```typescript
import { track } from '@vercel/analytics';

export type AnalyticsEvent =
  | 'meal_logged'
  | 'meal_edited'
  | 'meal_deleted'
  | 'withings_connected'
  | 'withings_disconnected'
  | 'withings_synced'
  | 'profile_updated'
  | 'camera_used'
  | 'upload_used'
  | 'export_data';

interface EventProperties {
  meal_logged?: {
    calories: number;
    confidence: number;
    method: 'camera' | 'upload';
  };
  meal_edited?: {
    meal_id: string;
  };
  meal_deleted?: {
    meal_id: string;
  };
  withings_connected?: {
    device_count: number;
  };
  withings_synced?: {
    sync_type: 'weight' | 'activity' | 'sleep';
    records_synced: number;
  };
  profile_updated?: {
    fields: string[];
  };
  camera_used?: {
    duration_seconds: number;
  };
  upload_used?: {
    file_size_kb: number;
  };
  export_data?: {
    format: 'csv' | 'json';
    record_count: number;
  };
}

export function trackEvent<T extends AnalyticsEvent>(
  event: T,
  properties?: EventProperties[T]
) {
  // Track in Vercel Analytics
  if (typeof window !== 'undefined') {
    track(event, properties as Record<string, any>);
  }

  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Analytics event:', event, properties);
  }
}

// Usage examples:
// trackEvent('meal_logged', { calories: 450, confidence: 0.85, method: 'camera' });
// trackEvent('withings_connected', { device_count: 2 });
// trackEvent('export_data', { format: 'csv', record_count: 150 });
```

**Integrate tracking into components**:

```typescript
// In FoodLogManager.tsx
import { trackEvent } from '@/lib/analytics';

const handleSave = async () => {
  // ... save logic ...
  trackEvent('meal_logged', {
    calories: totalCalories,
    confidence: confidenceScore,
    method: 'upload',
  });
};

const handleDelete = async (id: string) => {
  // ... delete logic ...
  trackEvent('meal_deleted', { meal_id: id });
};
```

#### Step 4: Uptime Monitoring

**File**: `src/app/api/health/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    // Check database connectivity
    const supabase = await createClient();
    const { error } = await supabase.from('user_profiles').select('count').limit(1);

    if (error) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          database: 'error',
          error: error.message,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
```

**Configure uptime monitoring** (e.g., UptimeRobot, Better Uptime):
- Monitor: `https://yourapp.com/api/health`
- Check interval: 5 minutes
- Alert if down for >5 minutes

---

### Task 8.6.3: Security Audit

**Problem**: Need to ensure application is secure before production.

**Solution**: Comprehensive security checklist and fixes.

#### Step 1: Environment Variables Audit

**File**: `.env.example`

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# OpenAI (for AI nutrition analysis)
OPENAI_API_KEY=sk-...

# Withings Integration
WITHINGS_CLIENT_ID=your-client-id
WITHINGS_CLIENT_SECRET=your-client-secret
WITHINGS_REDIRECT_URI=https://yourapp.com/api/integrations/withings/callback

# Inngest
INNGEST_EVENT_KEY=your-event-key
INNGEST_SIGNING_KEY=your-signing-key

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...

# Environment
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://yourapp.com
NEXT_PUBLIC_APP_VERSION=1.0.0
```

**Security checklist for environment variables**:
- [ ] No secrets in `.env.example`
- [ ] All production secrets in Vercel environment variables
- [ ] Proper `NEXT_PUBLIC_` prefix for client-side variables
- [ ] No hardcoded secrets in codebase (run: `rg "sk-|pk_|secret" src/`)
- [ ] `.env.local` in `.gitignore`

#### Step 2: API Route Security

**File**: `src/middleware.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/middleware';

// Rate limiting (simple in-memory implementation)
const rateLimitMap = new Map<string, number[]>();

function rateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(ip) || [];

  // Remove old requests outside the window
  const validRequests = requests.filter((time) => now - time < windowMs);

  if (validRequests.length >= limit) {
    return false; // Rate limit exceeded
  }

  validRequests.push(now);
  rateLimitMap.set(ip, validRequests);

  return true;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limiting for API routes
  if (pathname.startsWith('/api/')) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

    // 100 requests per minute
    if (!rateLimit(ip, 100, 60000)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
  }

  // Auth check for protected routes
  if (pathname.startsWith('/app')) {
    const { supabase, response } = createClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/api/:path*'],
};
```

#### Step 3: Content Security Policy

**File**: `next.config.js`

Add CSP headers:

```javascript
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        // ... existing headers ...
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https: blob:",
            "font-src 'self' data:",
            "connect-src 'self' https://*.supabase.co https://o*.ingest.sentry.io",
            "media-src 'self' blob:",
            "frame-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; '),
        },
      ],
    },
  ];
}
```

#### Step 4: Supabase RLS Policy Audit

**File**: `scripts/audit-rls.sql`

```sql
-- Audit script to verify RLS is enabled on all tables
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;

-- Should return 0 rows

-- Verify policies exist for user-specific tables
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public';

-- Check for tables without policies
SELECT
  t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND p.policyname IS NULL;

-- Should return 0 rows
```

Run audit:

```bash
psql $DATABASE_URL -f scripts/audit-rls.sql
```

#### Step 5: Dependency Audit

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# For high-severity issues that can't be auto-fixed
npm audit fix --force

# Check for outdated dependencies
npm outdated
```

**Create GitHub Dependabot configuration**:

**File**: `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    open-pull-requests-limit: 10
    versioning-strategy: increase
```

---

### Task 8.6.4: Documentation

**Problem**: Need comprehensive documentation for deployment and usage.

**Solution**: Create deployment guide, API docs, environment guide, and user guide.

#### Document 1: Deployment Guide

**File**: `docs/deployment.md`

```markdown
# Deployment Guide

## Prerequisites

- Node.js 18+
- npm or yarn
- Vercel account
- Supabase project
- OpenAI API key
- Withings developer account

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values:

\`\`\`bash
cp .env.example .env.local
\`\`\`

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `WITHINGS_CLIENT_ID`
- `WITHINGS_CLIENT_SECRET`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`

## Deploy to Vercel

### Option 1: Vercel Dashboard

1. Import GitHub repository
2. Configure environment variables
3. Deploy

### Option 2: Vercel CLI

\`\`\`bash
npm install -g vercel
vercel login
vercel --prod
\`\`\`

## Database Setup

1. Create Supabase project
2. Run migrations:

\`\`\`bash
supabase db push
\`\`\`

3. Enable real-time:

\`\`\`sql
ALTER PUBLICATION supabase_realtime ADD TABLE withings_sync_logs;
\`\`\`

## Post-Deployment

1. Verify health endpoint: `/api/health`
2. Test authentication flow
3. Test Withings OAuth callback
4. Monitor Sentry for errors
5. Check Vercel Analytics

## Rollback

\`\`\`bash
vercel rollback
\`\`\`

## Troubleshooting

### Build Fails
- Check environment variables
- Run `npm run build` locally
- Check Next.js build logs

### Database Connection Issues
- Verify Supabase URL and keys
- Check RLS policies
- Test with Supabase client

### OAuth Issues
- Verify redirect URIs match
- Check Withings client ID/secret
- Test callback endpoint
\`\`\`
```

#### Document 2: API Documentation

**File**: `docs/api.md`

```markdown
# API Documentation

## Authentication

All API routes under `/api/*` require authentication via Supabase session cookie.

## Nutrition

### POST /api/nutrition/analyze

Analyze food image with AI.

**Request:**
\`\`\`json
{
  "image": "base64_encoded_image"
}
\`\`\`

**Response:**
\`\`\`json
{
  "food_items": "Chicken Salad",
  "total_calories": 450,
  "protein": 35,
  "carbs": 20,
  "fat": 25,
  "confidence_score": 0.85
}
\`\`\`

### GET /api/nutrition/logs

Get user's nutrition logs.

**Query Params:**
- `start_date`: ISO date string
- `end_date`: ISO date string
- `limit`: number (default: 50)

**Response:**
\`\`\`json
{
  "data": [
    {
      "id": "uuid",
      "created_at": "2024-01-15T12:00:00Z",
      "food_items": "Chicken Salad",
      "total_calories": 450,
      "confidence_score": 0.85
    }
  ]
}
\`\`\`

## Withings

### POST /api/integrations/withings/auth/initiate

Start Withings OAuth flow.

**Response:**
\`\`\`json
{
  "authUrl": "https://account.withings.com/oauth2_user/authorize2?..."
}
\`\`\`

### GET /api/integrations/withings/callback

OAuth callback handler (automatic redirect).

### POST /api/integrations/withings/sync

Trigger manual sync.

**Response:**
\`\`\`json
{
  "success": true,
  "records_synced": 5
}
\`\`\`

## Health

### GET /api/health

Health check endpoint.

**Response:**
\`\`\`json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-01-15T12:00:00Z",
  "version": "1.0.0"
}
\`\`\`
\`\`\`
```

#### Document 3: User Guide

**File**: `docs/user-guide.md`

```markdown
# User Guide

## Getting Started

1. Create account at [yourapp.com/login]
2. Complete profile setup
3. Set daily calorie target

## Logging Meals

### Take Photo
1. Click "Take Photo" button
2. Grant camera permission
3. Position food in frame
4. Capture photo
5. Review AI analysis
6. Save meal

### Upload Photo
1. Click "Upload" button
2. Select image file
3. Wait for AI analysis
4. Review and save

## Connect Withings

1. Go to Settings
2. Click "Connect Withings"
3. Log in to Withings account
4. Grant permissions
5. View synced devices

## View Analytics

1. Go to Analytics
2. View weight trends
3. View calorie charts
4. Filter by date range

## Export Data

1. Go to Settings
2. Click "Export Data"
3. Choose format (CSV/JSON)
4. Download file
\`\`\`
```

---

### Task 8.6.5: Production Launch Checklist

**File**: `docs/launch-checklist.md`

```markdown
# Production Launch Checklist

## Pre-Launch (T-1 Week)

### Code Quality
- [ ] All Phase 8.1-8.5 tasks complete
- [ ] Test coverage ≥80%
- [ ] Lighthouse score ≥90
- [ ] No console errors in production build
- [ ] All TypeScript errors resolved
- [ ] ESLint warnings addressed

### Testing
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Visual regression tests passing
- [ ] Manual testing on iOS Safari
- [ ] Manual testing on Android Chrome
- [ ] Manual testing on desktop browsers

### Performance
- [ ] Bundle size analyzed and optimized
- [ ] Images optimized (WebP/AVIF)
- [ ] Code splitting implemented
- [ ] Lighthouse CI configured
- [ ] First Contentful Paint <1.5s
- [ ] Time to Interactive <3.5s

### Security
- [ ] Environment variables audited
- [ ] No secrets in codebase
- [ ] RLS policies enabled on all tables
- [ ] Security headers configured
- [ ] CSP headers configured
- [ ] Rate limiting implemented
- [ ] HTTPS enforced
- [ ] Dependencies audited (npm audit)

### Monitoring
- [ ] Sentry integrated and tested
- [ ] Vercel Analytics enabled
- [ ] Uptime monitoring configured
- [ ] Health check endpoint tested
- [ ] Error alerts configured
- [ ] Performance alerts configured

### Documentation
- [ ] Deployment guide complete
- [ ] API documentation complete
- [ ] Environment variables documented
- [ ] User guide complete
- [ ] README updated

### Infrastructure
- [ ] Production Supabase project created
- [ ] Database migrations applied
- [ ] Real-time enabled on required tables
- [ ] Storage buckets configured
- [ ] RLS policies tested
- [ ] Backup strategy in place

### Third-Party Services
- [ ] OpenAI API key configured
- [ ] Withings OAuth configured
- [ ] Withings redirect URI registered
- [ ] Inngest project configured
- [ ] Sentry project created
- [ ] Vercel project configured

## Launch Day (T-0)

### Deployment
- [ ] Final production build successful
- [ ] Environment variables set in Vercel
- [ ] Deploy to production
- [ ] Verify deployment successful
- [ ] Test production URL

### Smoke Tests
- [ ] Home page loads
- [ ] Login works
- [ ] Registration works
- [ ] Password reset works
- [ ] Dashboard loads
- [ ] Meal logging works (camera)
- [ ] Meal logging works (upload)
- [ ] Withings OAuth works
- [ ] Withings sync works
- [ ] Profile update works
- [ ] Data export works

### Monitoring
- [ ] Check Sentry for errors
- [ ] Check Vercel Analytics
- [ ] Check uptime monitor
- [ ] Monitor /api/health endpoint
- [ ] Monitor server logs

### Communication
- [ ] Announce launch
- [ ] Share app URL
- [ ] Monitor user feedback
- [ ] Prepare for support requests

## Post-Launch (T+1 Day)

### Metrics
- [ ] Review error rates
- [ ] Review performance metrics
- [ ] Review user analytics
- [ ] Check uptime percentage

### Issues
- [ ] Address critical bugs
- [ ] Respond to user feedback
- [ ] Plan hotfixes if needed

### Optimization
- [ ] Review Lighthouse scores
- [ ] Analyze bundle size
- [ ] Check for performance regressions
- [ ] Monitor API response times

## Post-Launch (T+1 Week)

### Review
- [ ] User feedback analysis
- [ ] Error rate analysis
- [ ] Performance metrics review
- [ ] Feature usage analysis

### Planning
- [ ] Prioritize bug fixes
- [ ] Plan feature improvements
- [ ] Schedule maintenance windows
- [ ] Plan Phase 9 features
\`\`\`
```

---

## Implementation Checklist

### Task 8.6.1: Performance Optimization
- [ ] Install bundle analyzer: `npm install -D @next/bundle-analyzer`
- [ ] Update `next.config.js` with optimization settings
- [ ] Run bundle analysis: `ANALYZE=true npm run build`
- [ ] Identify and optimize large bundles
- [ ] Implement code splitting for heavy components (Analytics, Camera)
- [ ] Update all images to use Next.js Image component
- [ ] Optimize font loading
- [ ] Install Lighthouse CI: `npm install -D @lhci/cli`
- [ ] Create `.lighthouserc.js` configuration
- [ ] Run Lighthouse CI: `npm run lighthouse`
- [ ] Address Lighthouse recommendations
- [ ] Verify Lighthouse score ≥90

### Task 8.6.2: Monitoring & Error Tracking
- [ ] Install Sentry: `npm install @sentry/nextjs`
- [ ] Run Sentry wizard: `npx @sentry/wizard@latest -i nextjs`
- [ ] Create `sentry.client.config.ts`
- [ ] Create `sentry.server.config.ts`
- [ ] Create `sentry.edge.config.ts`
- [ ] Update error handling to use Sentry
- [ ] Install Vercel Analytics: `npm install @vercel/analytics @vercel/speed-insights`
- [ ] Add Analytics to root layout
- [ ] Create `src/lib/analytics.ts` for custom events
- [ ] Integrate event tracking into components
- [ ] Create `/api/health` endpoint
- [ ] Configure uptime monitoring service
- [ ] Test all monitoring integrations

### Task 8.6.3: Security Audit
- [ ] Create `.env.example` with all variables
- [ ] Audit environment variables (no secrets exposed)
- [ ] Search for hardcoded secrets: `rg "sk-|pk_|secret" src/`
- [ ] Update `src/middleware.ts` with rate limiting
- [ ] Add CSP headers to `next.config.js`
- [ ] Create `scripts/audit-rls.sql`
- [ ] Run RLS audit: `psql $DATABASE_URL -f scripts/audit-rls.sql`
- [ ] Fix any RLS policy issues
- [ ] Run `npm audit` and fix vulnerabilities
- [ ] Create `.github/dependabot.yml`
- [ ] Test authentication flow
- [ ] Test rate limiting

### Task 8.6.4: Documentation
- [ ] Create `docs/deployment.md`
- [ ] Create `docs/api.md`
- [ ] Create `docs/environment.md`
- [ ] Create `docs/user-guide.md`
- [ ] Update main `README.md`
- [ ] Document all environment variables
- [ ] Document deployment process
- [ ] Document troubleshooting steps

### Task 8.6.5: Production Launch
- [ ] Create `docs/launch-checklist.md`
- [ ] Complete all pre-launch checklist items
- [ ] Create production Supabase project
- [ ] Run database migrations in production
- [ ] Configure all environment variables in Vercel
- [ ] Test staging deployment
- [ ] Deploy to production
- [ ] Complete launch day smoke tests
- [ ] Monitor for 24 hours
- [ ] Complete post-launch tasks

### Final Verification
- [ ] All Phase 8.1-8.5 tasks complete
- [ ] All Phase 8.6 tasks complete
- [ ] Test coverage ≥80%
- [ ] Lighthouse score ≥90
- [ ] Security audit passed
- [ ] All documentation complete
- [ ] Production deployment successful
- [ ] Monitoring active
- [ ] Zero critical errors in Sentry
- [ ] Celebrate! 🎉

---

## Files Created (20+ new files)

### Configuration (6 files)
1. `next.config.js` (updated with optimizations)
2. `.lighthouserc.js`
3. `sentry.client.config.ts`
4. `sentry.server.config.ts`
5. `sentry.edge.config.ts`
6. `.github/dependabot.yml`

### API Routes (1 file)
7. `src/app/api/health/route.ts`

### Utilities (2 files)
8. `src/lib/analytics.ts`
9. `src/middleware.ts` (updated)

### Scripts (1 file)
10. `scripts/audit-rls.sql`

### Documentation (9 files)
11. `docs/deployment.md`
12. `docs/api.md`
13. `docs/environment.md`
14. `docs/user-guide.md`
15. `docs/launch-checklist.md`
16. `README.md` (updated)
17. `.env.example` (updated)
18. `CONTRIBUTING.md`
19. `SECURITY.md`

---

## Files Modified (8+ files)

1. `next.config.js` (bundle analyzer, security headers, CSP)
2. `src/app/layout.tsx` (Vercel Analytics, Speed Insights)
3. `src/lib/errors.ts` (Sentry integration)
4. `src/middleware.ts` (rate limiting)
5. `package.json` (new scripts and dependencies)
6. `.gitignore` (ignore Lighthouse reports)
7. `src/app/app/analytics/page.tsx` (code splitting)
8. All components with images (use Next.js Image)

---

## Time Estimate

- Task 8.6.1 (Performance Optimization): 10-14 hours
  - Bundle analysis: 2-3 hours
  - Code splitting: 3-4 hours
  - Image optimization: 2-3 hours
  - Lighthouse CI: 3-4 hours
- Task 8.6.2 (Monitoring): 8-10 hours
  - Sentry setup: 3-4 hours
  - Vercel Analytics: 2-3 hours
  - Custom events: 2-3 hours
  - Uptime monitoring: 1 hour
- Task 8.6.3 (Security Audit): 6-8 hours
  - Environment audit: 2 hours
  - API security: 2-3 hours
  - RLS audit: 1-2 hours
  - Dependency audit: 1-2 hours
- Task 8.6.4 (Documentation): 6-8 hours
- Task 8.6.5 (Production Launch): 6-10 hours
  - Pre-launch checklist: 3-4 hours
  - Deployment: 2-3 hours
  - Post-launch monitoring: 1-3 hours

**Total: 36-50 hours**

---

## Success Metrics

After completing Phase 8.6:
- Lighthouse score ≥90 (achieved)
- Bundle size <500KB (achieved)
- Sentry integrated and capturing errors
- Vercel Analytics tracking events
- Security headers configured
- All documentation complete
- Production deployment successful
- Zero critical errors in first 24 hours
- Uptime >99.9% in first week
- **Application is production-ready! 🚀**