import { render, screen } from '@testing-library/react'
import { MobileNavigation } from '../mobile-navigation'
import { usePathname } from 'next/navigation'

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}))

describe('MobileNavigation', () => {
  it('renders all navigation items', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/app')

    render(<MobileNavigation />)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Tracker')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('highlights active navigation item', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/app/calorie-tracker')

    render(<MobileNavigation />)

    const trackerLink = screen.getByText('Tracker').closest('a')
    expect(trackerLink).toHaveClass('text-primary')
  })

  it('is hidden on desktop', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/app')

    const { container } = render(<MobileNavigation />)
    const nav = container.querySelector('nav')

    expect(nav).toHaveClass('md:hidden')
  })

  it('has touch-safe targets (44px minimum)', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/app')

    const { container } = render(<MobileNavigation />)
    const links = container.querySelectorAll('a')

    links.forEach(link => {
      expect(link).toHaveClass('min-h-[44px]')
      expect(link).toHaveClass('min-w-[44px]')
    })
  })
})