export type Plan = 'free' | 'pro' | 'enterprise'

export type PlanLimits = {
  maxRestaurants: number
  maxMenus: number
  maxCategoriesPerMenu: number
  maxProductsPerCategory: number
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxRestaurants: 1,
    maxMenus: 1,
    maxCategoriesPerMenu: 3,
    maxProductsPerCategory: 5,
  },
  pro: {
    maxRestaurants: 1,
    maxMenus: 3,
    maxCategoriesPerMenu: 5,
    maxProductsPerCategory: 10,
  },
  enterprise: {
    maxRestaurants: 3,
    maxMenus: 3,
    maxCategoriesPerMenu: 10,
    maxProductsPerCategory: 30,
  },
}

export function getPlanLimits(plan: Plan | null | undefined): PlanLimits {
  return PLAN_LIMITS[plan ?? 'free']
}

export function isPlan(value: unknown): value is Plan {
  return value === 'free' || value === 'pro' || value === 'enterprise'
}
