import { describe, it, expect } from 'vitest'
import { nextRenewalDate } from './storage'

describe('nextRenewalDate()', () => {
  describe('End-of-month edge cases', () => {
    it('Should handle Jan 31 + 1 month (monthly period)', () => {
      const from = new Date(2024, 1, 1) // Feb 1
      const result = nextRenewalDate('2024-01-31', 'monthly', from)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(1) // February
      expect(result.getDate()).toBe(29) // leap year
    })

    it('Should handle Jan 31 + 1 month in non-leap year', () => {
      const from = new Date(2023, 1, 1) // Feb 1
      const result = nextRenewalDate('2023-01-31', 'monthly', from)
      expect(result.getFullYear()).toBe(2023)
      expect(result.getMonth()).toBe(1) // February
      expect(result.getDate()).toBe(28)
    })

    it('Should handle Mar 31 + 1 month', () => {
      const from = new Date(2024, 3, 1) // Apr 1
      const result = nextRenewalDate('2024-03-31', 'monthly', from)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(3) // April
      expect(result.getDate()).toBe(30)
    })

    it('Should handle May 31 + 1 month', () => {
      const from = new Date(2024, 5, 1) // Jun 1
      const result = nextRenewalDate('2024-05-31', 'monthly', from)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(5) // June
      expect(result.getDate()).toBe(30)
    })

    it('Should recover to 31st after month with <31 days', () => {
      const from = new Date(2024, 2, 1) // Mar 1
      const result = nextRenewalDate('2024-01-31', 'monthly', from)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(2) // March
      expect(result.getDate()).toBe(31)
    })
  })

  describe('Monthly period', () => {
    it('Should calculate next renewal for regular months', () => {
      const from = new Date(2024, 0, 15)
      const result = nextRenewalDate('2024-01-15', 'monthly', from)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(1) // February
      expect(result.getDate()).toBe(15)
    })

    it('Should skip past dates and find next occurrence', () => {
      const result = nextRenewalDate('2024-01-15', 'monthly', new Date(2024, 1, 20))
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(2) // March
      expect(result.getDate()).toBe(15)
    })

    it('Should return same date if it matches exactly', () => {
      const from = new Date(2024, 0, 15)
      const result = nextRenewalDate('2024-01-15', 'monthly', from)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(1) // February
      expect(result.getDate()).toBe(15)
    })
  })

  describe('Quarterly period (3 months)', () => {
    it('Should calculate next quarterly renewal', () => {
      const from = new Date(2024, 0, 15)
      const result = nextRenewalDate('2024-01-15', 'quarterly', from)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(3) // April
      expect(result.getDate()).toBe(15)
    })

    it('Should handle quarterly with end-of-month dates', () => {
      const from = new Date(2024, 1, 1)
      const result = nextRenewalDate('2024-01-31', 'quarterly', from)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(3) // April
      expect(result.getDate()).toBe(30)
    })

    it('Should skip multiple quarters if needed', () => {
      const result = nextRenewalDate('2024-01-15', 'quarterly', new Date(2024, 7, 1))
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(9) // October
      expect(result.getDate()).toBe(15)
    })
  })

  describe('Semiannual period (6 months)', () => {
    it('Should calculate next semiannual renewal', () => {
      const from = new Date(2024, 0, 15)
      const result = nextRenewalDate('2024-01-15', 'semiannual', from)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(6) // July
      expect(result.getDate()).toBe(15)
    })

    it('Should handle year boundary', () => {
      const result = nextRenewalDate('2024-08-15', 'semiannual', new Date(2024, 7, 15))
      expect(result.getFullYear()).toBe(2025)
      expect(result.getMonth()).toBe(1) // February
      expect(result.getDate()).toBe(15)
    })

    it('Should handle semiannual with end-of-month dates', () => {
      const from = new Date(2024, 0, 31)
      const result = nextRenewalDate('2024-01-31', 'semiannual', from)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(6) // July
      expect(result.getDate()).toBe(31)
    })
  })

  describe('Annual period (12 months)', () => {
    it('Should calculate next annual renewal', () => {
      const from = new Date(2024, 0, 15)
      const result = nextRenewalDate('2024-01-15', 'annual', from)
      expect(result.getFullYear()).toBe(2025)
      expect(result.getMonth()).toBe(0) // January
      expect(result.getDate()).toBe(15)
    })

    it('Should handle leap year Feb 29 to non-leap year', () => {
      const result = nextRenewalDate('2024-02-29', 'annual', new Date(2024, 1, 29))
      expect(result.getFullYear()).toBe(2025)
      expect(result.getMonth()).toBe(1) // February
      expect(result.getDate()).toBe(28)
    })

    it('Should handle leap year Feb 29 to leap year', () => {
      const result = nextRenewalDate('2024-02-29', 'annual', new Date(2024, 1, 29))
      expect(result.getFullYear()).toBe(2025)
      expect(result.getMonth()).toBe(1)
      expect(result.getDate()).toBe(28)
    })

    it('Should skip multiple years if needed', () => {
      const result = nextRenewalDate('2020-01-15', 'annual', new Date(2024, 5, 1))
      expect(result.getFullYear()).toBe(2025)
      expect(result.getMonth()).toBe(0) // January
      expect(result.getDate()).toBe(15)
    })
  })

  describe('Invalid input handling', () => {
    it('Should return from date for invalid date string', () => {
      const from = new Date(2024, 0, 15)
      const result = nextRenewalDate('invalid-date', 'monthly', from)
      expect(result.getTime()).toBe(from.getTime())
    })

    it('Should return from date for malformed YYYY-MM-DD', () => {
      const from = new Date(2024, 0, 15)
      const result = nextRenewalDate('2024-13-45', 'monthly', from)
      expect(result.getTime()).toBe(from.getTime())
    })

    it('Should return from date for missing month', () => {
      const from = new Date(2024, 0, 15)
      const result = nextRenewalDate('2024', 'monthly', from)
      expect(result.getTime()).toBe(from.getTime())
    })
  })

  describe('Boundary conditions', () => {
    it('Should handle dates at year boundary', () => {
      const result = nextRenewalDate('2024-12-31', 'monthly', new Date(2024, 11, 31))
      expect(result.getFullYear()).toBe(2025)
      expect(result.getMonth()).toBe(0) // January
      expect(result.getDate()).toBe(31)
    })

    it('Should handle start of year', () => {
      const result = nextRenewalDate('2024-01-01', 'monthly', new Date(2024, 0, 1))
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(1) // February
      expect(result.getDate()).toBe(1)
    })

    it('Should find correct renewal when from date equals start date', () => {
      const from = new Date(2024, 0, 15)
      const result = nextRenewalDate('2024-01-15', 'monthly', from)
      const expected = new Date(2024, 1, 15)
      expect(result.getTime()).toBe(expected.getTime())
    })

    it('Should handle from date before start date', () => {
      const result = nextRenewalDate('2024-01-15', 'monthly', new Date(2024, 0, 1))
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(0) // January
      expect(result.getDate()).toBe(15)
    })
  })

  describe('Default from parameter', () => {
    it('Should use current date when from is not provided', () => {
      const beforeCall = new Date()
      const result = nextRenewalDate('2024-01-01', 'monthly')
      const afterCall = new Date()

      expect(result.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime())
      expect(result.getTime()).toBeLessThanOrEqual(afterCall.getTime() + 1000 * 60 * 60 * 24 * 32)
    })
  })

  describe('Deterministic behavior', () => {
    it('Should return same result for same inputs', () => {
      const input1 = nextRenewalDate('2024-01-31', 'monthly', new Date(2024, 1, 1))
      const input2 = nextRenewalDate('2024-01-31', 'monthly', new Date(2024, 1, 1))
      expect(input1.getTime()).toBe(input2.getTime())
    })

    it('Should handle long sequences correctly', () => {
      let current = new Date(2024, 0, 30) // One day before first renewal
      const renewals = []

      for (let i = 0; i < 12; i++) {
        const next = nextRenewalDate('2024-01-31', 'monthly', current)
        renewals.push({ month: next.getMonth(), day: next.getDate() })
        current = new Date(next.getTime() + 1)
      }

      expect(renewals[0]).toEqual({ month: 0, day: 31 })  // Jan 31
      expect(renewals[1]).toEqual({ month: 1, day: 29 })  // Feb 29
      expect(renewals[2]).toEqual({ month: 2, day: 31 })  // Mar 31
      expect(renewals[3]).toEqual({ month: 3, day: 30 })  // Apr 30
      expect(renewals[4]).toEqual({ month: 4, day: 31 })  // May 31
      expect(renewals[5]).toEqual({ month: 5, day: 30 })  // Jun 30
      expect(renewals[6]).toEqual({ month: 6, day: 31 })  // Jul 31
      expect(renewals[7]).toEqual({ month: 7, day: 31 })  // Aug 31
      expect(renewals[8]).toEqual({ month: 8, day: 30 })  // Sep 30
      expect(renewals[9]).toEqual({ month: 9, day: 31 })  // Oct 31
      expect(renewals[10]).toEqual({ month: 10, day: 30 }) // Nov 30
      expect(renewals[11]).toEqual({ month: 11, day: 31 }) // Dec 31
    })
  })
})
