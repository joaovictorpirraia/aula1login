import { render, screen } from '@testing-library/react'
import { DealsTable } from '@/app/(crm)/dashboard/components/DealsTable'

const mockDeals = [
  { id: '1', displayName: 'Empresa Alpha', value: '12000.00', status: 'won', created_at: '2026-06-01T10:00:00' },
  { id: '2', displayName: 'Empresa Beta', value: '8500.50', status: 'open', created_at: '2026-05-28T14:30:00' },
  { id: '3', displayName: 'Empresa Gama', value: '3000.00', status: 'lost', created_at: '2026-05-20T09:00:00' },
]

describe('DealsTable', () => {
  it('renders client names', () => {
    render(<DealsTable deals={mockDeals} />)
    expect(screen.getByText('Empresa Alpha')).toBeInTheDocument()
    expect(screen.getByText('Empresa Beta')).toBeInTheDocument()
    expect(screen.getByText('Empresa Gama')).toBeInTheDocument()
  })

  it('renders Won badge for won status', () => {
    render(<DealsTable deals={mockDeals} />)
    expect(screen.getByText('Ganho')).toBeInTheDocument()
  })

  it('renders Open badge for open status', () => {
    render(<DealsTable deals={mockDeals} />)
    expect(screen.getByText('Aberto')).toBeInTheDocument()
  })

  it('renders Lost badge for lost status', () => {
    render(<DealsTable deals={mockDeals} />)
    expect(screen.getByText('Perdido')).toBeInTheDocument()
  })

  it('renders empty state when no deals', () => {
    render(<DealsTable deals={[]} />)
    expect(screen.getByText('Nenhum negócio encontrado.')).toBeInTheDocument()
  })

  it('renders formatted currency values', () => {
    render(<DealsTable deals={mockDeals} />)
    expect(screen.getByText(/12\.000/)).toBeInTheDocument()
  })
})
