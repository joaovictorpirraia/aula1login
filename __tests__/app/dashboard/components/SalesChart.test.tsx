import { render, screen } from '@testing-library/react'
import { SalesChart } from '@/app/(crm)/dashboard/components/SalesChart'

// Recharts uses ResizeObserver which doesn't exist in jsdom
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

const mockData = [
  { date: '2026-06-01', total: 5000 },
  { date: '2026-06-05', total: 3200 },
]

describe('SalesChart', () => {
  it('renders chart title', () => {
    render(<SalesChart data={mockData} />)
    expect(screen.getByText('Vendas do Mês')).toBeInTheDocument()
  })

  it('renders empty state when no data', () => {
    render(<SalesChart data={[]} />)
    expect(screen.getByText('Nenhuma venda fechada este mês.')).toBeInTheDocument()
  })
})
