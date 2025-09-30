# Phase 8.2: Mobile Excellence - Technical Implementation

## Summary

**Goal**: Ensure every page is mobile-friendly with proper touch targets, responsive layouts, and optimized mobile experiences.

**Priority**: 🔴 CRITICAL
**Duration**: Week 2 (30-40 hours)
**Dependencies**: Phase 8.1 (Mobile Navigation must be complete)

### What We're Achieving

This phase focuses on mobile-first optimization across the entire application:

1. **Touch Target Compliance** - All interactive elements ≥44px (iOS/Android accessibility standard)
2. **Responsive Form Optimization** - Mobile-friendly forms with better spacing and larger inputs
3. **Camera Interface Enhancement** - Mobile-optimized camera controls with orientation handling
4. **Page-by-Page Mobile Audit** - Verify all 8 pages work flawlessly on mobile

**Impact**: Ensures professional mobile UX that meets platform guidelines and user expectations.

### Success Criteria

- [ ] 100% of interactive elements ≥44px touch targets
- [ ] All forms optimized for mobile (larger inputs, better spacing)
- [ ] Camera interface works on mobile browsers (iOS Safari, Android Chrome)
- [ ] All pages tested on real mobile devices (iOS and Android)
- [ ] No horizontal scrolling on mobile viewports
- [ ] All tests passing

---

## Technical Implementation

### Task 8.2.1: Touch Target Audit & Fix

**Problem**: Several components have touch targets <44px minimum (iOS/Android accessibility requirement).

**Found Issues**:
- User avatar button: `h-8 w-8` (32px) - too small
- Icon-only buttons: Various small sizes
- Mobile nav icons: Need verification

**Solution**: Update Button component and audit all interactive elements.

#### Files to Update

**File**: `src/components/ui/button.tsx`

Add `touch` size variant for mobile-safe buttons:

```typescript
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

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
      },
      size: {
        default: "h-10 px-4 py-2", // 40px height
        sm: "h-9 rounded-md px-3", // 36px height
        lg: "h-11 rounded-md px-8", // 44px height ✅
        icon: "h-10 w-10", // 40px - close but not ideal
        touch: "h-11 w-11", // 44px - NEW: mobile-safe size
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

**File**: `src/components/app/navigation.tsx`

Update avatar button to use touch-safe size:

```typescript
// Before (line 75):
<Button variant="ghost" className="relative h-8 w-8 rounded-full">
  <UserIcon className="h-5 w-5" />
</Button>

// After:
<Button variant="ghost" size="touch" className="relative rounded-full">
  <UserIcon className="h-5 w-5" />
</Button>
```

**File**: `src/app/globals.css`

Add touch target utility classes:

```css
@layer utilities {
  .touch-target {
    min-height: 44px;
    min-width: 44px;
  }

  /* Touch target only on mobile, normal on desktop */
  .touch-target-mobile {
    min-height: 44px;
    min-width: 44px;
  }

  @media (min-width: 768px) {
    .touch-target-mobile {
      min-height: auto;
      min-width: auto;
    }
  }
}
```

#### Touch Target Audit Checklist

Manually audit and fix each file:

**File**: `src/components/calorie-tracker/RecentMeals.tsx`
- [ ] Check delete/edit buttons are ≥44px
- [ ] Update icon-only buttons to use `size="touch"` on mobile

**File**: `src/components/calorie-tracker/FoodLogManager.tsx`
- [ ] Check action buttons (edit, delete) are ≥44px
- [ ] Update filter buttons if needed

**File**: `src/components/settings/withings-connection.tsx`
- [ ] Check "Connect Withings" button is ≥44px (should be fine)
- [ ] Check "Test Connection" and "Disconnect" buttons

**File**: `src/components/settings/withings-devices.tsx`
- [ ] Check device action buttons

**File**: `src/app/app/page.tsx` (Dashboard)
- [ ] Verify "Log Meal" button is touch-safe
- [ ] Check any clickable cards/elements

#### Testing

**File**: `src/components/ui/__tests__/button.test.tsx`

```typescript
import { render } from '@testing-library/react'
import { Button } from '../button'

describe('Button Touch Targets', () => {
  it('touch size variant meets 44px minimum', () => {
    const { container } = render(<Button size="touch">Click me</Button>)
    const button = container.querySelector('button')

    expect(button).toHaveClass('h-11')
    expect(button).toHaveClass('w-11')
  })

  it('lg size variant meets 44px height', () => {
    const { container } = render(<Button size="lg">Click me</Button>)
    const button = container.querySelector('button')

    expect(button).toHaveClass('h-11')
  })

  it('default size is close to 44px', () => {
    const { container } = render(<Button>Click me</Button>)
    const button = container.querySelector('button')

    expect(button).toHaveClass('h-10') // 40px - acceptable
  })
})
```

---

### Task 8.2.2: Responsive Form Optimization

**Problem**: Forms need mobile-specific improvements:
- Inputs should be larger (44px height minimum)
- Better spacing between fields on mobile
- Larger font sizes for readability
- Better error state visibility

**Solution**: Create mobile-optimized form components and update Input/Select components.

#### Files to Create

**File**: `src/components/ui/mobile-form.tsx`

```typescript
import { cn } from '@/lib/utils'
import React from 'react'

interface MobileFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode
  className?: string
}

export function MobileForm({ children, className, ...props }: MobileFormProps) {
  return (
    <form
      className={cn(
        "space-y-6 md:space-y-4", // More spacing on mobile
        className
      )}
      {...props}
    >
      {children}
    </form>
  )
}

interface MobileFormFieldProps {
  children: React.ReactNode
  error?: string
  className?: string
}

export function MobileFormField({ children, error, className }: MobileFormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {children}
      {error && (
        <p className="text-sm text-destructive font-medium" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

interface MobileFormSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function MobileFormSection({
  title,
  description,
  children,
  className
}: MobileFormSectionProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <h2 className="text-xl md:text-2xl font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}
```

#### Files to Update

**File**: `src/components/ui/input.tsx`

Update for mobile-friendly sizing:

```typescript
import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Increased height to h-11 (44px) for touch targets
          // text-base on mobile (16px prevents zoom), text-sm on desktop
          "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
```

**File**: `src/components/ui/textarea.tsx`

Update for mobile-friendly sizing:

```typescript
import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          // min-h-[88px] = 2 lines at 44px each
          // text-base on mobile, text-sm on desktop
          "flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
```

**File**: `src/components/ui/select.tsx`

Ensure Select trigger is 44px height:

```typescript
// Update SelectTrigger component:
const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      // h-11 = 44px for touch target compliance
      "flex h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName
```

**File**: `src/components/profile/profile-form.tsx`

Update to use MobileForm components:

```typescript
import { MobileForm, MobileFormField, MobileFormSection } from '@/components/ui/mobile-form'

export function ProfileForm({ user, initialProfile, onSuccess }: ProfileFormProps) {
  // ... existing state ...

  return (
    <MobileForm onSubmit={handleSubmit}>
      {message && (
        <StatusAlert variant={message.type} message={message.text} />
      )}

      <MobileFormSection
        title="Personal Information"
        description="Your basic profile details"
      >
        <MobileFormField error={errors?.fullName}>
          <Label htmlFor="fullName">Full Name</Label>
          <Input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </MobileFormField>

        {/* ... rest of form fields ... */}
      </MobileFormSection>

      {/* ... other sections ... */}
    </MobileForm>
  )
}
```

#### Testing

**File**: `src/components/ui/__tests__/mobile-form.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import { MobileForm, MobileFormField, MobileFormSection } from '../mobile-form'

describe('MobileForm Components', () => {
  it('MobileForm renders with correct spacing', () => {
    const { container } = render(
      <MobileForm>
        <div>Field 1</div>
      </MobileForm>
    )

    const form = container.querySelector('form')
    expect(form).toHaveClass('space-y-6')
    expect(form).toHaveClass('md:space-y-4')
  })

  it('MobileFormField displays error messages', () => {
    render(
      <MobileFormField error="This field is required">
        <input type="text" />
      </MobileFormField>
    )

    expect(screen.getByText('This field is required')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('MobileFormSection renders title and description', () => {
    render(
      <MobileFormSection
        title="Personal Info"
        description="Enter your details"
      >
        <div>Content</div>
      </MobileFormSection>
    )

    expect(screen.getByText('Personal Info')).toBeInTheDocument()
    expect(screen.getByText('Enter your details')).toBeInTheDocument()
  })
})
```

**File**: `src/components/ui/__tests__/input.test.tsx`

Update existing tests to verify new mobile-friendly sizing:

```typescript
import { render } from '@testing-library/react'
import { Input } from '../input'

describe('Input Mobile Optimization', () => {
  it('has 44px height for touch targets', () => {
    const { container } = render(<Input />)
    const input = container.querySelector('input')

    expect(input).toHaveClass('h-11') // 44px
  })

  it('uses text-base on mobile and text-sm on desktop', () => {
    const { container } = render(<Input />)
    const input = container.querySelector('input')

    expect(input).toHaveClass('text-base')
    expect(input).toHaveClass('md:text-sm')
  })
})
```

---

### Task 8.2.3: Mobile Camera Optimization

**Problem**: Camera interface needs mobile-specific enhancements:
- Larger capture button for easy tapping
- Orientation change handling
- Better mobile browser compatibility

**Solution**: Update OptimizedCamera component with mobile optimizations.

#### Files to Update

**File**: `src/components/calorie-tracker/OptimizedCamera.tsx`

Add mobile-specific camera controls and orientation handling:

```typescript
"use client"

import { useState, useRef, useEffect } from 'react'
import { Camera, X, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function OptimizedCamera({ onCapture, onClose }: OptimizedCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')

  // Detect device orientation
  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(
        window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
      )
    }

    window.addEventListener('resize', handleOrientationChange)
    handleOrientationChange()

    return () => window.removeEventListener('resize', handleOrientationChange)
  }, [])

  // Initialize camera
  useEffect(() => {
    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        })

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
        setStream(mediaStream)
      } catch (error) {
        console.error('Error accessing camera:', error)
      }
    }

    startCamera()

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [facingMode])

  const handleCapture = () => {
    if (!videoRef.current) return

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(videoRef.current, 0, 0)

    canvas.toBlob((blob) => {
      if (blob) {
        onCapture(blob)
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
        }
      }
    }, 'image/jpeg', 0.9)
  }

  const handleFlipCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* Camera Controls Overlay */}
      <div className="absolute inset-0 flex flex-col">
        {/* Top Bar */}
        <div className="flex justify-between items-center p-4 bg-gradient-to-b from-black/50 to-transparent">
          <Button
            variant="ghost"
            size="touch"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </Button>

          <Button
            variant="ghost"
            size="touch"
            onClick={handleFlipCamera}
            className="text-white hover:bg-white/20"
          >
            <RotateCw className="h-6 w-6" />
          </Button>
        </div>

        {/* Bottom Controls */}
        <div className="mt-auto p-8 pb-safe bg-gradient-to-t from-black/50 to-transparent">
          <div className="flex justify-center items-center">
            {/* Capture Button - Extra large for mobile */}
            <Button
              onClick={handleCapture}
              disabled={!stream}
              size="touch"
              className="rounded-full w-20 h-20 bg-white hover:bg-white/90 text-black shadow-lg"
            >
              <Camera className="h-10 w-10" />
            </Button>
          </div>

          {/* Orientation Hint */}
          {orientation === 'landscape' && (
            <p className="text-center text-white text-sm mt-4">
              Rotate device for better capture
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
```

**File**: `src/app/globals.css`

Add safe area padding for iOS:

```css
@layer utilities {
  /* ... existing utilities ... */

  .pb-safe {
    padding-bottom: calc(1rem + env(safe-area-inset-bottom));
  }

  .pt-safe {
    padding-top: calc(1rem + env(safe-area-inset-top));
  }
}
```

#### Testing

**File**: `src/components/calorie-tracker/__tests__/OptimizedCamera.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OptimizedCamera } from '../OptimizedCamera'

// Mock getUserMedia
const mockGetUserMedia = jest.fn()
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
  },
})

describe('OptimizedCamera Mobile', () => {
  beforeEach(() => {
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [],
    })
  })

  it('renders camera controls', async () => {
    render(
      <OptimizedCamera
        onCapture={jest.fn()}
        onClose={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /camera/i })).toBeInTheDocument()
    })
  })

  it('capture button is 80x80px (large touch target)', () => {
    const { container } = render(
      <OptimizedCamera
        onCapture={jest.fn()}
        onClose={jest.fn()}
      />
    )

    const captureButton = container.querySelector('button.w-20')
    expect(captureButton).toHaveClass('w-20')
    expect(captureButton).toHaveClass('h-20')
  })

  it('shows flip camera button', () => {
    render(
      <OptimizedCamera
        onCapture={jest.fn()}
        onClose={jest.fn()}
      />
    )

    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
  })

  it('detects orientation changes', () => {
    // Mock window dimensions
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })
    Object.defineProperty(window, 'innerWidth', { value: 400, writable: true })

    render(
      <OptimizedCamera
        onCapture={jest.fn()}
        onClose={jest.fn()}
      />
    )

    // Portrait mode - no hint
    expect(screen.queryByText(/rotate device/i)).not.toBeInTheDocument()

    // Simulate landscape
    Object.defineProperty(window, 'innerHeight', { value: 400, writable: true })
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true })
    fireEvent(window, new Event('resize'))

    // Landscape mode - shows hint
    waitFor(() => {
      expect(screen.getByText(/rotate device/i)).toBeInTheDocument()
    })
  })
})
```

---

### Task 8.2.4: Mobile Page-by-Page Audit

**Goal**: Manually test and verify each page works perfectly on mobile devices.

#### Page Testing Checklist

For each page, verify:
- [ ] No horizontal scrolling
- [ ] All text is readable (minimum 16px on mobile)
- [ ] All buttons are tappable (≥44px)
- [ ] Forms work correctly
- [ ] Images/charts display properly
- [ ] Navigation works
- [ ] Safe area respected (iOS notch, Android nav bar)

**Page 1: Landing Page** (`/`)
- [ ] Test on iPhone (Safari)
- [ ] Test on Android (Chrome)
- [ ] Verify hero section scales properly
- [ ] Check CTA buttons are touch-friendly
- [ ] Verify gradient background displays correctly

**Page 2: Login** (`/login`)
- [ ] Email input is 44px height
- [ ] Password input is 44px height
- [ ] Login button is touch-friendly
- [ ] Form validation works
- [ ] "Forgot password" link is tappable
- [ ] No zoom when focusing inputs (16px font minimum)

**Page 3: Reset Password** (`/reset-password`)
- [ ] Email input is 44px height
- [ ] Submit button is touch-friendly
- [ ] Success/error messages display correctly
- [ ] Back to login link is tappable

**Page 4: Dashboard** (`/app`)
- [ ] Bottom navigation visible and functional
- [ ] "Log Meal" button is touch-friendly
- [ ] Stats cards are readable
- [ ] Charts display properly (responsive)
- [ ] Recent meals section scrolls smoothly
- [ ] Profile avatar in top nav is 44px

**Page 5: Calorie Tracker** (`/app/calorie-tracker`)
- [ ] Camera button is large and tappable
- [ ] Upload button is touch-friendly
- [ ] Recent meals display properly
- [ ] Confidence badges are visible
- [ ] Daily summary is readable
- [ ] Forms work correctly

**Page 6: Analytics** (`/app/analytics`)
- [ ] Charts resize for mobile viewport
- [ ] Chart interactions work (tap, not hover)
- [ ] Filter buttons are touch-friendly
- [ ] Date pickers work on mobile
- [ ] Legends are readable

**Page 7: Profile** (`/app/profile`)
- [ ] All form inputs are 44px height
- [ ] Checkboxes are large enough (24px minimum)
- [ ] Select dropdowns work on mobile
- [ ] Save button is touch-friendly
- [ ] Success/error messages display
- [ ] Keyboard doesn't obscure inputs (proper scrolling)

**Page 8: Settings** (`/app/settings`)
- [ ] Withings connection button is touch-friendly
- [ ] Device cards are tappable
- [ ] Toggle switches work smoothly
- [ ] Modal dialogs display correctly
- [ ] Disconnect button has confirmation

---

## Implementation Checklist

### Task 8.2.1: Touch Target Audit
- [ ] Update `src/components/ui/button.tsx` with `touch` size variant
- [ ] Update `src/components/app/navigation.tsx` avatar button
- [ ] Add touch target utilities to `src/app/globals.css`
- [ ] Audit and fix `src/components/calorie-tracker/RecentMeals.tsx`
- [ ] Audit and fix `src/components/calorie-tracker/FoodLogManager.tsx`
- [ ] Audit and fix `src/components/settings/withings-connection.tsx`
- [ ] Audit and fix `src/components/settings/withings-devices.tsx`
- [ ] Audit and fix `src/app/app/page.tsx` (Dashboard)
- [ ] Create test file `src/components/ui/__tests__/button.test.tsx`
- [ ] Run tests: `npm test button.test.tsx`
- [ ] Manual test: Use browser devtools to inspect touch targets

### Task 8.2.2: Responsive Form Optimization
- [ ] Create `src/components/ui/mobile-form.tsx`
- [ ] Update `src/components/ui/input.tsx` (h-11, text-base on mobile)
- [ ] Update `src/components/ui/textarea.tsx` (min-h-[88px], text-base)
- [ ] Update `src/components/ui/select.tsx` (h-11 trigger)
- [ ] Update `src/components/profile/profile-form.tsx` to use MobileForm
- [ ] Create test file `src/components/ui/__tests__/mobile-form.test.tsx`
- [ ] Update test file `src/components/ui/__tests__/input.test.tsx`
- [ ] Run tests: `npm test mobile-form.test.tsx input.test.tsx`
- [ ] Manual test: Fill out profile form on mobile device
- [ ] Verify no zoom when focusing inputs (must be 16px font minimum)

### Task 8.2.3: Mobile Camera Optimization
- [ ] Update `src/components/calorie-tracker/OptimizedCamera.tsx`
- [ ] Add orientation change detection
- [ ] Increase capture button size to 80x80px
- [ ] Add flip camera functionality
- [ ] Add `.pb-safe` and `.pt-safe` utilities to `src/app/globals.css`
- [ ] Create test file `src/components/calorie-tracker/__tests__/OptimizedCamera.test.tsx`
- [ ] Run tests: `npm test OptimizedCamera.test.tsx`
- [ ] Manual test: Open camera on iPhone Safari
- [ ] Manual test: Open camera on Android Chrome
- [ ] Test flip camera on devices with multiple cameras
- [ ] Verify safe area padding works on iPhone with notch

### Task 8.2.4: Mobile Page Audit
- [ ] Test Landing page on mobile (iOS + Android)
- [ ] Test Login page on mobile (iOS + Android)
- [ ] Test Reset Password page on mobile (iOS + Android)
- [ ] Test Dashboard on mobile (iOS + Android)
- [ ] Test Calorie Tracker on mobile (iOS + Android)
- [ ] Test Analytics page on mobile (iOS + Android)
- [ ] Test Profile page on mobile (iOS + Android)
- [ ] Test Settings page on mobile (iOS + Android)
- [ ] Document any issues found
- [ ] Fix issues and re-test

### Final Verification
- [ ] Run full test suite: `npm test`
- [ ] Run linter: `npm run lint`
- [ ] Build production: `npm run build`
- [ ] Test on iPhone (Safari, Chrome)
- [ ] Test on Android (Chrome, Samsung Internet)
- [ ] Test on tablet (iPad, Android tablet)
- [ ] Verify no horizontal scrolling on any page
- [ ] Verify all touch targets ≥44px
- [ ] Verify all forms work correctly
- [ ] Commit changes with descriptive message

---

## Files Created (3 new files)

1. `src/components/ui/mobile-form.tsx`
2. `src/components/ui/__tests__/mobile-form.test.tsx`
3. `src/components/calorie-tracker/__tests__/OptimizedCamera.test.tsx`

## Files Modified (10 files)

1. `src/components/ui/button.tsx`
2. `src/components/ui/input.tsx`
3. `src/components/ui/textarea.tsx`
4. `src/components/ui/select.tsx`
5. `src/components/app/navigation.tsx`
6. `src/components/profile/profile-form.tsx`
7. `src/components/calorie-tracker/OptimizedCamera.tsx`
8. `src/app/globals.css`
9. `src/components/ui/__tests__/button.test.tsx` (update)
10. `src/components/ui/__tests__/input.test.tsx` (update)

## Files to Audit & Potentially Fix (6 files)

1. `src/components/calorie-tracker/RecentMeals.tsx`
2. `src/components/calorie-tracker/FoodLogManager.tsx`
3. `src/components/settings/withings-connection.tsx`
4. `src/components/settings/withings-devices.tsx`
5. `src/app/app/page.tsx`
6. Any other files with icon-only buttons

---

## Time Estimate

- Task 8.2.1 (Touch Target Audit): 6-8 hours
- Task 8.2.2 (Responsive Forms): 6-8 hours
- Task 8.2.3 (Mobile Camera): 4-6 hours
- Task 8.2.4 (Page Audit): 8-10 hours
- Testing & verification: 4-6 hours

**Total: 28-38 hours**

---

## Success Metrics

After completing Phase 8.2:
- 100% of interactive elements ≥44px
- All forms optimized for mobile
- Camera works flawlessly on mobile browsers
- All 8 pages tested and verified on real devices
- No accessibility warnings in browser devtools
- Lighthouse accessibility score >95
- All tests passing