import { render, screen } from '@testing-library/react'
import { MetricCards } from '@/app/dashboard/components/MetricCards'

describe('MetricCards', () => {
  it('renders total sales formatted as BRL', () => {
    render(<MetricCards totalSales={48200} openDeals={7} goal={60000} />)
    expect(screen.getByText(/48\.200/)).toBeInTheDocument()
  })

  it('renders open deals count', () => {
    render(<MetricCards totalSales={0} openDeals={7} goal={null} />)
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('renders "Sem meta definida" when goal is null', () => {
    render(<MetricCards totalSales={0} openDeals={0} goal={null} />)
    expect(screen.getByText('Sem meta definida')).toBeInTheDocument()
  })

  it('renders progress percentage when goal is set', () => {
    render(<MetricCards totalSales={30000} openDeals={0} goal={60000} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('caps progress at 100% when sales exceed goal', () => {
    render(<MetricCards totalSales={80000} openDeals={0} goal={60000} />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})
