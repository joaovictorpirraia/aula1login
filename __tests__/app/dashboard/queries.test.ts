// __tests__/app/dashboard/queries.test.ts
const mockSupabase = {
  from: jest.fn(),
}

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => mockSupabase,
}))

// Mock React.cache to be a passthrough (just returns the function)
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  cache: (fn: unknown) => fn,
}))

import { getTotalSales, getOpenDealsCount, getMonthlyGoal, getChartData, getRecentDeals } from '@/app/dashboard/queries'

function buildChain(terminal: jest.Mock) {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn(),
    eq: jest.fn(),
    gte: jest.fn(),
    lt: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    maybeSingle: jest.fn(),
  }
  // each method returns the chain except for terminal calls
  Object.keys(chain).forEach((key) => {
    chain[key].mockReturnValue(chain)
  })
  // Override the terminal method to resolve the mock value
  chain[Object.keys(chain).find(k => chain[k] === terminal) ?? 'lt'] = terminal
  return chain
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('getTotalSales', () => {
  it('returns sum of won deal values for current month', async () => {
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockResolvedValue({ data: [{ value: '1000.00' }, { value: '500.50' }], error: null }),
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const result = await getTotalSales()
    expect(result).toBeCloseTo(1500.5)
    expect(mockChain.eq).toHaveBeenCalledWith('status', 'won')
  })

  it('returns 0 when no won deals exist', async () => {
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockResolvedValue({ data: [], error: null }),
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const result = await getTotalSales()
    expect(result).toBe(0)
  })

  it('throws on Supabase error', async () => {
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    }
    mockSupabase.from.mockReturnValue(mockChain)

    await expect(getTotalSales()).rejects.toThrow('DB error')
  })
})

describe('getOpenDealsCount', () => {
  it('returns count of open deals', async () => {
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ count: 7, error: null }),
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const result = await getOpenDealsCount()
    expect(result).toBe(7)
  })

  it('returns 0 when count is null', async () => {
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ count: null, error: null }),
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const result = await getOpenDealsCount()
    expect(result).toBe(0)
  })

  it('throws on Supabase error', async () => {
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ count: null, error: { message: 'DB error' } }),
    }
    mockSupabase.from.mockReturnValue(mockChain)

    await expect(getOpenDealsCount()).rejects.toThrow('DB error')
  })
})

describe('getMonthlyGoal', () => {
  it('returns goal_value as number when row exists', async () => {
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { goal_value: '10000.00' }, error: null }),
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const result = await getMonthlyGoal()
    expect(result).toBe(10000)
  })

  it('returns null when no goal row exists', async () => {
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const result = await getMonthlyGoal()
    expect(result).toBeNull()
  })

  it('throws on Supabase error', async () => {
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    }
    mockSupabase.from.mockReturnValue(mockChain)

    await expect(getMonthlyGoal()).rejects.toThrow('DB error')
  })
})

describe('getChartData', () => {
  it('groups won deals by closed_date and returns sorted entries', async () => {
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [
          { value: '500.00', closed_date: '2026-06-01' },
          { value: '300.00', closed_date: '2026-06-01' },
          { value: '200.00', closed_date: '2026-06-05' },
        ],
        error: null,
      }),
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const result = await getChartData()
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ date: '2026-06-01', total: 800 })
    expect(result[1]).toEqual({ date: '2026-06-05', total: 200 })
  })

  it('returns empty array when no won deals', async () => {
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const result = await getChartData()
    expect(result).toEqual([])
  })

  it('throws on Supabase error', async () => {
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    }
    mockSupabase.from.mockReturnValue(mockChain)

    await expect(getChartData()).rejects.toThrow('DB error')
  })
})

describe('getRecentDeals', () => {
  it('returns array of deals', async () => {
    const deals = [
      { id: '1', client_name: 'Empresa A', value: '5000', status: 'won', created_at: '2026-06-01' },
      { id: '2', client_name: 'Empresa B', value: '3000', status: 'open', created_at: '2026-05-28' },
    ]
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: deals, error: null }),
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const result = await getRecentDeals()
    expect(result).toHaveLength(2)
    expect(result[0].client_name).toBe('Empresa A')
  })

  it('returns empty array when no deals', async () => {
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const result = await getRecentDeals()
    expect(result).toEqual([])
  })

  it('throws on Supabase error', async () => {
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    }
    mockSupabase.from.mockReturnValue(mockChain)

    await expect(getRecentDeals()).rejects.toThrow('DB error')
  })
})
