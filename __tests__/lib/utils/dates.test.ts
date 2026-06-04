import { getMonthBoundariesUTC, formatCurrency, getSixMonthsAgoUTC } from '@/lib/utils/dates'

describe('getMonthBoundariesUTC', () => {
  it('returns start as first day of current month at midnight UTC', () => {
    const { start } = getMonthBoundariesUTC()
    expect(start.getUTCDate()).toBe(1)
    expect(start.getUTCHours()).toBe(0)
    expect(start.getUTCMinutes()).toBe(0)
    expect(start.getUTCSeconds()).toBe(0)
  })

  it('returns end as first day of next month at midnight UTC', () => {
    const { start, end } = getMonthBoundariesUTC()
    const expectedEndMonth = (start.getUTCMonth() + 1) % 12
    expect(end.getUTCDate()).toBe(1)
    expect(end.getUTCMonth()).toBe(expectedEndMonth)
    expect(end.getUTCHours()).toBe(0)
  })

  it('end is exactly one month after start', () => {
    const { start, end } = getMonthBoundariesUTC()
    const diffMs = end.getTime() - start.getTime()
    const daysInMonth = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)
    ).getUTCDate()
    expect(diffMs).toBe(daysInMonth * 24 * 60 * 60 * 1000)
  })

  it('start date string format is YYYY-MM-01', () => {
    const { start } = getMonthBoundariesUTC()
    const str = start.toISOString().split('T')[0]
    expect(str).toMatch(/^\d{4}-\d{2}-01$/)
  })
})

describe('formatCurrency', () => {
  it('formats number as BRL currency', () => {
    const result = formatCurrency(1234.56)
    expect(result).toContain('1.234,56')
  })

  it('formats zero correctly', () => {
    const result = formatCurrency(0)
    expect(result).toContain('0,00')
  })
})

describe('getSixMonthsAgoUTC', () => {
  it('returns start as first day of month, 6 months ago, at midnight UTC', () => {
    const { start } = getSixMonthsAgoUTC()
    expect(start.getUTCDate()).toBe(1)
    expect(start.getUTCHours()).toBe(0)
    expect(start.getUTCMinutes()).toBe(0)
    expect(start.getUTCSeconds()).toBe(0)
  })

  it('returns startStr in YYYY-MM-01 format', () => {
    const { startStr } = getSixMonthsAgoUTC()
    expect(startStr).toMatch(/^\d{4}-\d{2}-01$/)
  })

  it('start is before the current month start', () => {
    const { start } = getSixMonthsAgoUTC()
    const now = new Date()
    const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    expect(start.getTime()).toBeLessThan(currentMonthStart.getTime())
  })
})
