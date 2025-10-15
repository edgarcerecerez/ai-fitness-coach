# Phase 8.3: Design System Overhaul - Technical Implementation

## Summary

**Goal**: Replace 200+ hardcoded colors with semantic theme colors and apply frosted glass aesthetic consistently across all components.

**Priority**: 🔴 CRITICAL
**Duration**: Week 3 (40-50 hours)
**Dependencies**: Phase 8.1 (StatusAlert component), Phase 8.2 (Touch-safe buttons)

### What We're Achieving

This phase addresses critical design system violations that break theming and dark mode:

1. **Color System Replacement** - Replace 200+ hardcoded color instances with semantic theme colors
2. **Badge Component Enhancement** - Add semantic variants (success, warning, info) using theme colors
3. **Glass Aesthetic Consistency** - Apply frosted glass styling to all 43 components (currently only 3)
4. **Background Gradient Standardization** - Use consistent gradient across all pages
5. **Dark Mode Verification** - Ensure all changes work in dark mode

**Impact**: Proper theming system that respects user preferences, consistent visual design, and maintainable color system.

### Success Criteria

- [ ] Zero hardcoded color instances (bg-blue-500, text-green-800, etc.)
- [ ] All components use semantic theme colors
- [ ] Badge component has success/warning/info variants
- [ ] Glass aesthetic applied to all pages
- [ ] Dark mode works correctly everywhere
- [ ] All tests passing

---

## Technical Implementation

### Task 8.3.1: Replace Hardcoded Colors with Theme Colors

**Problem**: 200+ instances of hardcoded Tailwind colors break theming and dark mode.

**Violations Found**:
- `bg-blue-50`, `bg-blue-100`, `bg-blue-500`, `bg-blue-600`
- `text-blue-600`, `text-blue-700`, `text-blue-800`
- `bg-green-100`, `text-green-800`, `bg-green-50`
- `bg-yellow-100`, `text-yellow-800`
- `bg-red-100`, `text-red-800`, `bg-red-600`
- `bg-gray-50`, `bg-gray-100`, `text-gray-500`, `text-gray-600`
- `border-gray-300`, `border-red-200`, `border-green-200`

**Solution**: Systematic replacement with semantic colors from Tailwind CSS 4 theme.

#### Color Mapping Guide

| Hardcoded Color | Semantic Replacement | Use Case | Reasoning |
|----------------|---------------------|----------|-----------|
| `bg-blue-50`, `bg-blue-100` | `bg-muted` or `bg-secondary` | Light backgrounds | Muted works for subtle backgrounds |
| `bg-blue-500`, `bg-blue-600` | `bg-primary` | Primary actions, badges | Theme's primary color |
| `text-blue-600`, `text-blue-700` | `text-primary` | Primary text, links | Consistent with primary color |
| `border-blue-200` | `border-primary/20` | Primary borders | Transparent overlay maintains contrast |
| `bg-green-50`, `bg-green-100` | `bg-chart-1/10` | Success backgrounds | chart-1 is green in theme |
| `text-green-600`, `text-green-800` | `text-chart-1` | Success text | Green from chart colors |
| `border-green-200` | `border-chart-1/20` | Success borders | Transparent green |
| `bg-yellow-50`, `bg-yellow-100` | `bg-chart-4/10` | Warning backgrounds | chart-4 is yellow in theme |
| `text-yellow-600`, `text-yellow-800` | `text-chart-4` | Warning text | Yellow from chart colors |
| `border-yellow-200` | `border-chart-4/20` | Warning borders | Transparent yellow |
| `bg-red-50`, `bg-red-100` | `bg-destructive/10` | Error backgrounds | Destructive is red in theme |
| `text-red-600`, `text-red-800` | `text-destructive` | Error text | Theme's destructive color |
| `bg-red-600` | `bg-destructive` | Error buttons | Solid destructive background |
| `border-red-200` | `border-destructive/20` | Error borders | Transparent red |
| `bg-gray-50`, `bg-gray-100` | `bg-muted` | Muted backgrounds | Theme's muted background |
| `text-gray-500`, `text-gray-600` | `text-muted-foreground` | Secondary text | Theme's muted text |
| `border-gray-300` | `border-input` or `border` | Input borders | Theme's border colors |

#### Files to Update

**File 1**: `src/app/reset-password/page.tsx` (CRITICAL - 10+ hardcoded colors)

```typescript
// Before (lines 288-295):
{message && (
  <Alert className={`mb-6 ${
    message.type === "error"
      ? "border-red-200 bg-red-50"
      : "border-green-200 bg-green-50"
  }`}>
    <AlertDescription className={
      message.type === "error" ? "text-red-800" : "text-green-800"
    }>
      {message.text}
    </AlertDescription>
  </Alert>
)}

// After:
import { StatusAlert } from '@/components/ui/status-alert'

{message && (
  <StatusAlert
    variant={message.type}
    message={message.text}
    className="mb-6"
  />
)}
```

**File 2**: `src/components/calorie-tracker/FoodLogManager.tsx` (HIGH - 15+ hardcoded colors)

```typescript
// Before (lines 198-210):
{log.confidence_score >= 0.8 ? (
  <Badge className="bg-green-100 text-green-800 border-green-200">
    High Confidence
  </Badge>
) : log.confidence_score >= 0.6 ? (
  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
    Medium Confidence
  </Badge>
) : (
  <Badge className="bg-red-100 text-red-800 border-red-200">
    Low Confidence
  </Badge>
)}

// After:
import { getConfidenceBadgeVariant, getConfidenceText } from '@/lib/nutrition-helpers'

<Badge variant={getConfidenceBadgeVariant(log.confidence_score)}>
  {getConfidenceText(log.confidence_score)}
</Badge>
```

**File 3**: `src/components/calorie-tracker/RecentMeals.tsx` (HIGH - 12+ hardcoded colors)

```typescript
// Before (lines 45-50):
<div className="text-gray-500 text-sm">
  No meals logged yet
</div>

// After:
<div className="text-muted-foreground text-sm">
  No meals logged yet
</div>

// Before (lines 80-85):
<div className="bg-gray-50 rounded-lg p-4">
  <h3 className="text-gray-900 font-semibold">
    {meal.food_items}
  </h3>
</div>

// After:
<div className="bg-muted rounded-lg p-4">
  <h3 className="text-foreground font-semibold">
    {meal.food_items}
  </h3>
</div>
```

**File 4**: `src/components/calorie-tracker/DailyCalorieSummary.tsx` (MEDIUM - 8+ hardcoded colors)

```typescript
// Before (lines 30-40):
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
  <h3 className="text-blue-900 font-semibold">Today's Summary</h3>
  <div className="text-blue-600 text-2xl font-bold">
    {totalCalories} cal
  </div>
  <Progress
    value={(totalCalories / targetCalories) * 100}
    className="bg-blue-100"
  />
</div>

// After:
<div className="bg-muted border border-border rounded-lg p-4">
  <h3 className="text-foreground font-semibold">Today's Summary</h3>
  <div className="text-primary text-2xl font-bold">
    {totalCalories} cal
  </div>
  <Progress
    value={(totalCalories / targetCalories) * 100}
    className="bg-muted"
  />
</div>
```

**File 5**: `src/components/settings/withings-connection.tsx` (HIGH - 20+ hardcoded colors)

```typescript
// Before (lines 188-195):
<Alert className="border-blue-200 bg-blue-50">
  <AlertDescription className="text-blue-800">
    Connect your Withings account to automatically sync weight data
  </AlertDescription>
</Alert>

// After:
<StatusAlert
  variant="info"
  message="Connect your Withings account to automatically sync weight data"
/>

// Before (lines 210-220):
<div className="bg-green-50 border border-green-200 rounded-lg p-4">
  <div className="flex items-center gap-2">
    <CheckCircle2 className="h-5 w-5 text-green-600" />
    <span className="text-green-800 font-semibold">Connected</span>
  </div>
</div>

// After:
<div className="bg-chart-1/10 border border-chart-1/20 rounded-lg p-4">
  <div className="flex items-center gap-2">
    <CheckCircle2 className="h-5 w-5 text-chart-1" />
    <span className="text-chart-1 font-semibold">Connected</span>
  </div>
</div>

// Before (lines 225-235):
<Button
  variant="outline"
  className="border-red-300 text-red-600 hover:bg-red-50"
>
  Disconnect
</Button>

// After:
<Button variant="destructive" className="border-destructive/20">
  Disconnect
</Button>
```

**File 6**: `src/components/settings/withings-sync-status.tsx` (MEDIUM - 10+ hardcoded colors)

```typescript
// Before (lines 45-55):
{syncStatus.status === 'syncing' && (
  <div className="flex items-center gap-2 text-blue-600">
    <RefreshCw className="h-4 w-4 animate-spin" />
    <span>Syncing...</span>
  </div>
)}

{syncStatus.status === 'success' && (
  <div className="flex items-center gap-2 text-green-600">
    <CheckCircle2 className="h-4 w-4" />
    <span>Synced successfully</span>
  </div>
)}

{syncStatus.status === 'error' && (
  <div className="flex items-center gap-2 text-red-600">
    <AlertCircle className="h-4 w-4" />
    <span>Sync failed</span>
  </div>
)}

// After:
{syncStatus.status === 'syncing' && (
  <div className="flex items-center gap-2 text-primary">
    <RefreshCw className="h-4 w-4 animate-spin" />
    <span>Syncing...</span>
  </div>
)}

{syncStatus.status === 'success' && (
  <div className="flex items-center gap-2 text-chart-1">
    <CheckCircle2 className="h-4 w-4" />
    <span>Synced successfully</span>
  </div>
)}

{syncStatus.status === 'error' && (
  <div className="flex items-center gap-2 text-destructive">
    <AlertCircle className="h-4 w-4" />
    <span>Sync failed</span>
  </div>
)}
```

**File 7**: `src/components/settings/withings-devices.tsx` (MEDIUM - 8+ hardcoded colors)

**File 8**: `src/components/settings/withings-notification-settings.tsx` (LOW - 5+ hardcoded colors)

**File 9**: `src/components/calorie-tracker/OptimizedCamera.tsx` (LOW - 3+ hardcoded colors)

**File 10**: `src/components/calorie-tracker/photo-upload.tsx` (LOW - 5+ hardcoded colors)

**File 11**: `src/app/login/page.tsx` (MEDIUM - 8+ hardcoded colors)

```typescript
// Before (lines 120-130):
<Alert className="border-red-200 bg-red-50">
  <AlertDescription className="text-red-800">
    Invalid email or password
  </AlertDescription>
</Alert>

// After:
<StatusAlert
  variant="error"
  message="Invalid email or password"
/>
```

**File 12**: `src/app/app/profile/page.tsx` (Will be fixed by ProfileForm component refactor)

#### Automated Color Replacement Script

**File**: `scripts/fix-colors.sh`

```bash
#!/bin/bash
# Automated color replacement script
# Run with: bash scripts/fix-colors.sh

echo "Starting automated color replacement..."

# Blue backgrounds
echo "Replacing blue backgrounds..."
find src -name "*.tsx" -o -name "*.ts" | while read file; do
  sed -i '' 's/bg-blue-50/bg-muted/g' "$file"
  sed -i '' 's/bg-blue-100/bg-secondary/g' "$file"
  sed -i '' 's/bg-blue-500/bg-primary/g' "$file"
  sed -i '' 's/bg-blue-600/bg-primary/g' "$file"
done

# Blue text
echo "Replacing blue text..."
find src -name "*.tsx" -o -name "*.ts" | while read file; do
  sed -i '' 's/text-blue-600/text-primary/g' "$file"
  sed -i '' 's/text-blue-700/text-primary/g' "$file"
  sed -i '' 's/text-blue-800/text-primary/g' "$file"
  sed -i '' 's/text-blue-900/text-foreground/g' "$file"
done

# Gray backgrounds and text
echo "Replacing gray colors..."
find src -name "*.tsx" -o -name "*.ts" | while read file; do
  sed -i '' 's/bg-gray-50/bg-muted/g' "$file"
  sed -i '' 's/bg-gray-100/bg-muted/g' "$file"
  sed -i '' 's/text-gray-500/text-muted-foreground/g' "$file"
  sed -i '' 's/text-gray-600/text-muted-foreground/g' "$file"
  sed -i '' 's/text-gray-900/text-foreground/g' "$file"
  sed -i '' 's/border-gray-300/border-input/g' "$file"
done

echo "Automated replacement complete!"
echo ""
echo "⚠️  MANUAL REVIEW REQUIRED:"
echo "1. Green/red colors (context-dependent)"
echo "2. Border colors (some need /20 transparency)"
echo "3. Dark mode appearance"
echo "4. Component-specific overrides"
echo ""
echo "Next steps:"
echo "1. Run: npm run lint"
echo "2. Review changes: git diff"
echo "3. Test dark mode"
echo "4. Fix remaining hardcoded colors manually"
```

#### Manual Review Checklist

After running automated script:

- [ ] Search for remaining `bg-blue-` instances: `rg "bg-blue-" src/`
- [ ] Search for remaining `text-blue-` instances: `rg "text-blue-" src/`
- [ ] Search for remaining `bg-green-` instances: `rg "bg-green-" src/`
- [ ] Search for remaining `text-green-` instances: `rg "text-green-" src/`
- [ ] Search for remaining `bg-red-` instances: `rg "bg-red-" src/`
- [ ] Search for remaining `text-red-` instances: `rg "text-red-" src/`
- [ ] Search for remaining `bg-yellow-` instances: `rg "bg-yellow-" src/`
- [ ] Search for remaining `text-yellow-` instances: `rg "text-yellow-" src/`
- [ ] Verify dark mode works for all replaced colors
- [ ] Check contrast ratios with DevTools

#### Testing

**File**: `src/lib/__tests__/color-system.test.ts`

```typescript
import { render } from '@testing-library/react'
import * as fs from 'fs'
import * as path from 'path'

describe('Color System Compliance', () => {
  const forbiddenColors = [
    'bg-blue-50', 'bg-blue-100', 'bg-blue-500', 'bg-blue-600',
    'text-blue-600', 'text-blue-700', 'text-blue-800',
    'bg-green-50', 'bg-green-100', 'text-green-600', 'text-green-800',
    'bg-yellow-50', 'bg-yellow-100', 'text-yellow-600', 'text-yellow-800',
    'bg-red-50', 'bg-red-100', 'bg-red-600', 'text-red-600', 'text-red-800',
    'bg-gray-50', 'bg-gray-100', 'text-gray-500', 'text-gray-600',
    'border-gray-300', 'border-red-200', 'border-green-200', 'border-yellow-200',
  ]

  const srcDir = path.join(__dirname, '../../')

  function findFiles(dir: string, ext: string): string[] {
    const files: string[] = []
    const items = fs.readdirSync(dir)

    for (const item of items) {
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        files.push(...findFiles(fullPath, ext))
      } else if (item.endsWith(ext)) {
        files.push(fullPath)
      }
    }

    return files
  }

  it('should not have hardcoded colors in component files', () => {
    const componentFiles = findFiles(path.join(srcDir, 'components'), '.tsx')
    const violations: { file: string; color: string; line: number }[] = []

    componentFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')

      lines.forEach((line, index) => {
        forbiddenColors.forEach(color => {
          if (line.includes(color)) {
            violations.push({
              file: path.relative(srcDir, file),
              color,
              line: index + 1
            })
          }
        })
      })
    })

    if (violations.length > 0) {
      console.error('Hardcoded color violations found:')
      violations.forEach(v => {
        console.error(`  ${v.file}:${v.line} - ${v.color}`)
      })
    }

    expect(violations).toHaveLength(0)
  })

  it('should not have hardcoded colors in page files', () => {
    const pageFiles = findFiles(path.join(srcDir, 'app'), '.tsx')
    const violations: { file: string; color: string }[] = []

    pageFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8')

      forbiddenColors.forEach(color => {
        if (content.includes(color)) {
          violations.push({
            file: path.relative(srcDir, file),
            color
          })
        }
      })
    })

    expect(violations).toHaveLength(0)
  })
})
```

---

### Task 8.3.2: Update Badge Component with Semantic Variants

**Problem**: Badge component lacks semantic variants, forcing inline color definitions.

**Solution**: Add success, warning, info variants using theme colors.

#### Files to Update

**File**: `src/components/ui/badge.tsx`

```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline:
          "text-foreground",
        success:
          "border-transparent bg-chart-1/10 text-chart-1 hover:bg-chart-1/20 dark:bg-chart-1/20 dark:hover:bg-chart-1/30",
        warning:
          "border-transparent bg-chart-4/10 text-chart-4 hover:bg-chart-4/20 dark:bg-chart-4/20 dark:hover:bg-chart-4/30",
        info:
          "border-transparent bg-chart-2/10 text-chart-2 hover:bg-chart-2/20 dark:bg-chart-2/20 dark:hover:bg-chart-2/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
```

#### Usage Examples

```typescript
// Success badge (green)
<Badge variant="success">High Confidence</Badge>
<Badge variant="success">Connected</Badge>
<Badge variant="success">Verified</Badge>

// Warning badge (yellow)
<Badge variant="warning">Medium Confidence</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="warning">Limited Data</Badge>

// Error badge (red)
<Badge variant="destructive">Low Confidence</Badge>
<Badge variant="destructive">Disconnected</Badge>
<Badge variant="destructive">Error</Badge>

// Info badge (blue)
<Badge variant="info">Processing</Badge>
<Badge variant="info">New</Badge>
<Badge variant="info">Beta</Badge>

// Default (primary theme color)
<Badge variant="default">Default</Badge>

// Secondary (muted)
<Badge variant="secondary">Secondary</Badge>

// Outline (no background)
<Badge variant="outline">Outline</Badge>
```

#### Testing

**File**: `src/components/ui/__tests__/badge.test.tsx`

```typescript
import { render } from '@testing-library/react'
import { Badge } from '../badge'

describe('Badge Semantic Variants', () => {
  it('renders success variant with correct colors', () => {
    const { container } = render(<Badge variant="success">Success</Badge>)
    const badge = container.querySelector('div')

    expect(badge).toHaveClass('bg-chart-1/10')
    expect(badge).toHaveClass('text-chart-1')
  })

  it('renders warning variant with correct colors', () => {
    const { container } = render(<Badge variant="warning">Warning</Badge>)
    const badge = container.querySelector('div')

    expect(badge).toHaveClass('bg-chart-4/10')
    expect(badge).toHaveClass('text-chart-4')
  })

  it('renders info variant with correct colors', () => {
    const { container } = render(<Badge variant="info">Info</Badge>)
    const badge = container.querySelector('div')

    expect(badge).toHaveClass('bg-chart-2/10')
    expect(badge).toHaveClass('text-chart-2')
  })

  it('renders destructive variant with correct colors', () => {
    const { container } = render(<Badge variant="destructive">Error</Badge>)
    const badge = container.querySelector('div')

    expect(badge).toHaveClass('bg-destructive')
    expect(badge).toHaveClass('text-destructive-foreground')
  })

  it('uses default variant when not specified', () => {
    const { container } = render(<Badge>Default</Badge>)
    const badge = container.querySelector('div')

    expect(badge).toHaveClass('bg-primary')
    expect(badge).toHaveClass('text-primary-foreground')
  })

  it('has dark mode styles', () => {
    const { container } = render(<Badge variant="success">Success</Badge>)
    const badge = container.querySelector('div')

    expect(badge).toHaveClass('dark:bg-chart-1/20')
  })
})
```

---

### Task 8.3.3: Apply Frosted Glass Aesthetic Consistently

**Problem**: Glass morphism only applied to 3 pages (login, landing, dashboard). 43 other components use standard cards.

**Solution**: Update Card and Button components with glass variants, apply throughout.

#### Files to Update

**File**: `src/components/ui/card.tsx`

```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const cardVariants = cva(
  "rounded-xl text-card-foreground",
  {
    variants: {
      variant: {
        default: "bg-card border shadow-sm",
        glass: "glass-panel border-0 shadow-lg", // Uses global glass-panel class
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

**File**: `src/components/ui/button.tsx`

Add glass variants:

```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        glass: "glass-button", // NEW: solid glass button
        "glass-outline": "glass-button-outline", // NEW: outline glass button
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        touch: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

**File**: `src/app/globals.css`

Verify glass morphism classes are properly defined:

```css
@layer components {
  /* Frosted glass panel */
  .glass-panel {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
  }

  .dark .glass-panel {
    background: rgba(15, 15, 15, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
  }

  /* Glass button (solid) */
  .glass-button {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: rgba(0, 0, 0, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 16px 0 rgba(31, 38, 135, 0.1);
    transition: all 0.2s ease;
  }

  .glass-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 1);
    box-shadow: 0 6px 20px 0 rgba(31, 38, 135, 0.15);
  }

  .dark .glass-button {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .dark .glass-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
  }

  /* Glass button (outline) */
  .glass-button-outline {
    background: transparent;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: rgba(0, 0, 0, 0.9);
    border: 1px solid rgba(0, 0, 0, 0.2);
    transition: all 0.2s ease;
  }

  .glass-button-outline:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.5);
  }

  .dark .glass-button-outline {
    color: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .dark .glass-button-outline:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }
}
```

#### Apply Glass Variant to All Pages

**File**: `src/app/app/calorie-tracker/page.tsx`

```typescript
// Before:
<Card className="p-6">
  <CardHeader>
    <CardTitle>Recent Meals</CardTitle>
  </CardHeader>
  <CardContent>
    {/* content */}
  </CardContent>
</Card>

// After:
<Card variant="glass" className="p-6">
  <CardHeader>
    <CardTitle>Recent Meals</CardTitle>
  </CardHeader>
  <CardContent>
    {/* content */}
  </CardContent>
</Card>
```

Apply to all pages:
- `src/app/app/calorie-tracker/page.tsx`
- `src/app/app/analytics/page.tsx`
- `src/app/app/settings/page.tsx`
- `src/app/app/profile/page.tsx`

#### Apply Glass Buttons Where Appropriate

```typescript
// On glass-styled pages (dashboard, login):
<Button variant="glass">Log Meal</Button>
<Button variant="glass-outline">Cancel</Button>

// On standard pages, use default variants:
<Button>Save</Button>
<Button variant="outline">Cancel</Button>
```

#### Testing

**File**: `src/components/ui/__tests__/card.test.tsx`

```typescript
import { render } from '@testing-library/react'
import { Card } from '../card'

describe('Card Glass Variant', () => {
  it('renders default variant with border and shadow', () => {
    const { container } = render(<Card>Content</Card>)
    const card = container.querySelector('div')

    expect(card).toHaveClass('bg-card')
    expect(card).toHaveClass('border')
    expect(card).toHaveClass('shadow-sm')
  })

  it('renders glass variant with glass-panel class', () => {
    const { container } = render(<Card variant="glass">Content</Card>)
    const card = container.querySelector('div')

    expect(card).toHaveClass('glass-panel')
    expect(card).toHaveClass('border-0')
    expect(card).toHaveClass('shadow-lg')
  })

  it('applies custom className in addition to variant', () => {
    const { container } = render(
      <Card variant="glass" className="custom-class">
        Content
      </Card>
    )
    const card = container.querySelector('div')

    expect(card).toHaveClass('glass-panel')
    expect(card).toHaveClass('custom-class')
  })
})
```

---

### Task 8.3.4: Standardize Background Gradients

**Problem**: Inconsistent background styles across pages.

**Solution**: Use `app-gradient-bg` class everywhere, update gradient for iOS-style look.

#### Files to Update

**File**: `src/app/globals.css`

Update gradient definition:

```css
@layer components {
  /* Main app background gradient - iOS inspired */
  .app-gradient-bg {
    background: linear-gradient(135deg,
      oklch(0.95 0.02 140) 0%,    /* Soft green tint */
      oklch(0.97 0.01 180) 50%,   /* Light blue-white */
      oklch(0.98 0.01 220) 100%   /* Soft purple tint */
    );
    min-height: 100vh;
  }

  .dark .app-gradient-bg {
    background: linear-gradient(135deg,
      oklch(0.15 0.02 140) 0%,    /* Dark green tint */
      oklch(0.18 0.01 180) 50%,   /* Dark blue */
      oklch(0.16 0.01 220) 100%   /* Dark purple tint */
    );
  }

  /* Alternative: Simpler gradient for better performance */
  .app-gradient-bg-simple {
    background: linear-gradient(180deg,
      hsl(var(--background)) 0%,
      hsl(var(--muted) / 0.3) 100%
    );
    min-height: 100vh;
  }
}
```

#### Apply to All Page Layouts

**File**: `src/app/app/profile/page.tsx`

```typescript
// Before:
<div className="bg-gradient-to-br from-blue-50 to-indigo-100">
  {/* content */}
</div>

// After:
<div className="min-h-screen app-gradient-bg">
  {/* content */}
</div>
```

**File**: `src/app/app/calorie-tracker/page.tsx`

```typescript
// Before:
<div className="bg-gray-50">
  {/* content */}
</div>

// After:
<div className="min-h-screen app-gradient-bg">
  {/* content */}
</div>
```

**File**: `src/app/app/settings/page.tsx`

Ensure it uses `app-gradient-bg`:

```typescript
<div className="min-h-screen app-gradient-bg">
  <div className="container mx-auto px-4 py-8">
    {/* content */}
  </div>
</div>
```

**File**: `src/app/app/analytics/page.tsx`

Verify it uses `app-gradient-bg`:

```typescript
<div className="min-h-screen app-gradient-bg">
  <div className="container mx-auto px-4 py-8">
    {/* content */}
  </div>
</div>
```

**Note**: `src/app/app/layout.tsx` already applies `app-gradient-bg` at the layout level, so individual pages may not need it unless they override the layout background.

---

### Task 8.3.5: Dark Mode Verification

**Problem**: Need to verify all color changes work correctly in dark mode.

**Solution**: Manual testing and automated dark mode screenshots.

#### Dark Mode Testing Checklist

Manual testing steps:

- [ ] Enable dark mode in browser/OS
- [ ] Test Landing page - verify gradient, text contrast
- [ ] Test Login page - verify form visibility, glass effect
- [ ] Test Dashboard - verify charts, stats, glass panels
- [ ] Test Calorie Tracker - verify badges, forms, camera
- [ ] Test Analytics - verify charts, legends, filters
- [ ] Test Profile - verify form inputs, checkboxes, sections
- [ ] Test Settings - verify Withings cards, badges, buttons
- [ ] Test all Badge variants - success, warning, info, destructive
- [ ] Test all Button variants - glass, glass-outline
- [ ] Test all StatusAlert variants - error, success, warning, info
- [ ] Verify text contrast ratios meet WCAG AA (4.5:1 for normal text)
- [ ] Check glass effects are visible but not too opaque
- [ ] Verify borders are visible in dark mode

#### Automated Dark Mode Testing

**File**: `e2e/dark-mode.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Dark Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Enable dark mode
    await page.emulateMedia({ colorScheme: 'dark' })
  })

  test('dashboard displays correctly in dark mode', async ({ page }) => {
    await page.goto('/app')

    // Verify dark mode class is applied
    const html = page.locator('html')
    await expect(html).toHaveClass(/dark/)

    // Take screenshot
    await expect(page).toHaveScreenshot('dashboard-dark.png', {
      fullPage: true,
    })
  })

  test('calorie tracker displays correctly in dark mode', async ({ page }) => {
    await page.goto('/app/calorie-tracker')

    await expect(page).toHaveScreenshot('calorie-tracker-dark.png', {
      fullPage: true,
    })
  })

  test('profile page displays correctly in dark mode', async ({ page }) => {
    await page.goto('/app/profile')

    await expect(page).toHaveScreenshot('profile-dark.png', {
      fullPage: true,
    })
  })

  test('settings page displays correctly in dark mode', async ({ page }) => {
    await page.goto('/app/settings')

    await expect(page).toHaveScreenshot('settings-dark.png', {
      fullPage: true,
    })
  })

  test('badge variants have correct colors in dark mode', async ({ page }) => {
    await page.setContent(`
      <div style="padding: 20px; background: #0a0a0a;">
        <div class="dark">
          <div class="inline-flex items-center rounded-full border-transparent bg-chart-1/20 text-chart-1 px-2.5 py-0.5 text-xs font-semibold">
            Success Badge
          </div>
          <div class="inline-flex items-center rounded-full border-transparent bg-chart-4/20 text-chart-4 px-2.5 py-0.5 text-xs font-semibold ml-2">
            Warning Badge
          </div>
          <div class="inline-flex items-center rounded-full border-transparent bg-destructive/20 text-destructive px-2.5 py-0.5 text-xs font-semibold ml-2">
            Error Badge
          </div>
        </div>
      </div>
    `)

    await expect(page).toHaveScreenshot('badges-dark.png')
  })

  test('glass panels are visible in dark mode', async ({ page }) => {
    await page.setContent(`
      <div style="padding: 20px; background: #0a0a0a;">
        <div class="dark">
          <div class="glass-panel rounded-xl p-6">
            <h3 class="text-foreground font-semibold mb-2">Glass Panel</h3>
            <p class="text-muted-foreground">This is a frosted glass panel in dark mode.</p>
          </div>
        </div>
      </div>
    `)

    await expect(page).toHaveScreenshot('glass-panel-dark.png')
  })
})
```

#### Contrast Ratio Verification

**File**: `scripts/check-contrast.ts`

```typescript
import * as fs from 'fs'
import * as path from 'path'

interface ColorPair {
  foreground: string
  background: string
  context: string
}

// WCAG AA requires 4.5:1 for normal text, 3:1 for large text
function checkContrastRatio(fg: string, bg: string): number {
  // Simplified - use actual contrast calculation in production
  // This is a placeholder
  return 4.5 // Mock value
}

const criticalColorPairs: ColorPair[] = [
  // Light mode
  { foreground: 'text-foreground', background: 'bg-background', context: 'Light mode body text' },
  { foreground: 'text-muted-foreground', background: 'bg-background', context: 'Light mode secondary text' },
  { foreground: 'text-primary', background: 'bg-background', context: 'Light mode primary text' },
  { foreground: 'text-chart-1', background: 'bg-chart-1/10', context: 'Light mode success badge' },
  { foreground: 'text-chart-4', background: 'bg-chart-4/10', context: 'Light mode warning badge' },
  { foreground: 'text-destructive', background: 'bg-destructive/10', context: 'Light mode error badge' },

  // Dark mode
  { foreground: 'dark:text-foreground', background: 'dark:bg-background', context: 'Dark mode body text' },
  { foreground: 'dark:text-chart-1', background: 'dark:bg-chart-1/20', context: 'Dark mode success badge' },
]

console.log('Verifying contrast ratios...\n')

criticalColorPairs.forEach(pair => {
  const ratio = checkContrastRatio(pair.foreground, pair.background)
  const passes = ratio >= 4.5

  console.log(`${passes ? '✅' : '❌'} ${pair.context}`)
  console.log(`   ${pair.foreground} on ${pair.background}`)
  console.log(`   Ratio: ${ratio.toFixed(2)}:1 ${passes ? '(PASS)' : '(FAIL)'}\n`)
})
```

---

## Implementation Checklist

### Task 8.3.1: Replace Hardcoded Colors
- [ ] Create `scripts/fix-colors.sh` automated replacement script
- [ ] Run automated script: `bash scripts/fix-colors.sh`
- [ ] Manually fix `src/app/reset-password/page.tsx` (use StatusAlert)
- [ ] Manually fix `src/components/calorie-tracker/FoodLogManager.tsx`
- [ ] Manually fix `src/components/calorie-tracker/RecentMeals.tsx`
- [ ] Manually fix `src/components/calorie-tracker/DailyCalorieSummary.tsx`
- [ ] Manually fix `src/components/settings/withings-connection.tsx`
- [ ] Manually fix `src/components/settings/withings-sync-status.tsx`
- [ ] Manually fix `src/components/settings/withings-devices.tsx`
- [ ] Manually fix `src/components/settings/withings-notification-settings.tsx`
- [ ] Manually fix `src/components/calorie-tracker/OptimizedCamera.tsx`
- [ ] Manually fix `src/components/calorie-tracker/photo-upload.tsx`
- [ ] Manually fix `src/app/login/page.tsx`
- [ ] Search for remaining hardcoded colors: `rg "bg-blue-" src/`
- [ ] Search for remaining hardcoded colors: `rg "text-green-" src/`
- [ ] Search for remaining hardcoded colors: `rg "bg-red-" src/`
- [ ] Create test file `src/lib/__tests__/color-system.test.ts`
- [ ] Run test: `npm test color-system.test.ts`

### Task 8.3.2: Update Badge Component
- [ ] Update `src/components/ui/badge.tsx` with semantic variants
- [ ] Create test file `src/components/ui/__tests__/badge.test.tsx`
- [ ] Run test: `npm test badge.test.tsx`
- [ ] Update all components using Badge to use new variants
- [ ] Verify badges in light mode
- [ ] Verify badges in dark mode

### Task 8.3.3: Apply Frosted Glass Aesthetic
- [ ] Update `src/components/ui/card.tsx` with glass variant
- [ ] Update `src/components/ui/button.tsx` with glass variants
- [ ] Verify glass classes in `src/app/globals.css`
- [ ] Update `src/app/app/calorie-tracker/page.tsx` - use Card variant="glass"
- [ ] Update `src/app/app/analytics/page.tsx` - use Card variant="glass"
- [ ] Update `src/app/app/settings/page.tsx` - use Card variant="glass"
- [ ] Update `src/app/app/profile/page.tsx` - use Card variant="glass"
- [ ] Update dashboard buttons to use glass variants
- [ ] Create test file `src/components/ui/__tests__/card.test.tsx`
- [ ] Run test: `npm test card.test.tsx`
- [ ] Verify glass effect on all pages (light mode)
- [ ] Verify glass effect on all pages (dark mode)

### Task 8.3.4: Standardize Background Gradients
- [ ] Update gradient in `src/app/globals.css`
- [ ] Remove custom gradient from `src/app/app/profile/page.tsx`
- [ ] Remove custom background from `src/app/app/calorie-tracker/page.tsx`
- [ ] Verify `src/app/app/settings/page.tsx` uses app-gradient-bg
- [ ] Verify `src/app/app/analytics/page.tsx` uses app-gradient-bg
- [ ] Test gradient in light mode
- [ ] Test gradient in dark mode

### Task 8.3.5: Dark Mode Verification
- [ ] Enable dark mode in browser
- [ ] Test all pages manually (checklist above)
- [ ] Install Playwright: `npm install -D @playwright/test`
- [ ] Create `e2e/dark-mode.spec.ts` test file
- [ ] Run Playwright tests: `npx playwright test dark-mode.spec.ts`
- [ ] Review screenshots in `test-results/`
- [ ] Fix any contrast issues found
- [ ] Create `scripts/check-contrast.ts` (optional)
- [ ] Document any known dark mode issues

### Final Verification
- [ ] Run full test suite: `npm test`
- [ ] Run linter: `npm run lint`
- [ ] Build production: `npm run build`
- [ ] Verify zero hardcoded colors: `rg "bg-blue-|text-green-|bg-red-" src/`
- [ ] Test light mode on all pages
- [ ] Test dark mode on all pages
- [ ] Check accessibility with DevTools
- [ ] Verify Lighthouse score >90
- [ ] Commit changes with descriptive message

---

## Files Created (5 new files)

1. `scripts/fix-colors.sh` (automated color replacement)
2. `src/lib/__tests__/color-system.test.ts` (color compliance test)
3. `src/components/ui/__tests__/badge.test.tsx` (badge variant tests)
4. `src/components/ui/__tests__/card.test.tsx` (card variant tests)
5. `e2e/dark-mode.spec.ts` (dark mode visual tests)

## Files Modified (20+ files)

1. `src/components/ui/badge.tsx` (add semantic variants)
2. `src/components/ui/card.tsx` (add glass variant)
3. `src/components/ui/button.tsx` (add glass variants)
4. `src/app/globals.css` (update gradient, verify glass classes)
5. `src/app/reset-password/page.tsx` (replace colors)
6. `src/components/calorie-tracker/FoodLogManager.tsx` (replace colors)
7. `src/components/calorie-tracker/RecentMeals.tsx` (replace colors)
8. `src/components/calorie-tracker/DailyCalorieSummary.tsx` (replace colors)
9. `src/components/settings/withings-connection.tsx` (replace colors)
10. `src/components/settings/withings-sync-status.tsx` (replace colors)
11. `src/components/settings/withings-devices.tsx` (replace colors)
12. `src/components/settings/withings-notification-settings.tsx` (replace colors)
13. `src/components/calorie-tracker/OptimizedCamera.tsx` (replace colors)
14. `src/components/calorie-tracker/photo-upload.tsx` (replace colors)
15. `src/app/login/page.tsx` (replace colors)
16. `src/app/app/calorie-tracker/page.tsx` (glass cards, gradient)
17. `src/app/app/analytics/page.tsx` (glass cards)
18. `src/app/app/settings/page.tsx` (glass cards)
19. `src/app/app/profile/page.tsx` (glass cards, gradient)
20. All other files with hardcoded colors (discovered during audit)

---

## Time Estimate

- Task 8.3.1 (Replace Hardcoded Colors): 12-16 hours
  - Automated script: 1 hour
  - Manual fixes: 8-10 hours
  - Testing: 3-5 hours
- Task 8.3.2 (Badge Component): 2-3 hours
- Task 8.3.3 (Glass Aesthetic): 6-8 hours
  - Component updates: 3-4 hours
  - Apply throughout app: 2-3 hours
  - Testing: 1-2 hours
- Task 8.3.4 (Background Gradients): 2-3 hours
- Task 8.3.5 (Dark Mode Verification): 8-10 hours
  - Manual testing: 4-6 hours
  - Automated tests: 2-3 hours
  - Fixes: 2-3 hours
- Documentation and final verification: 4-6 hours

**Total: 34-46 hours**

---

## Success Metrics

After completing Phase 8.3:
- 0 hardcoded color instances (was 200+)
- Badge component has 7 semantic variants
- Glass aesthetic applied to 100% of pages (was 3/46)
- Consistent gradient across all pages
- Dark mode fully functional and tested
- Lighthouse accessibility score >95
- All tests passing
- Production build successful