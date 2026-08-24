export type Plan = 'free' | 'pro' | 'enterprise'
export type SubscriptionStatus = 'active' | 'trialing' | 'paused' | 'canceled' | 'manual'

export interface Restaurant {
  id: string
  user_id: string
  name: string
  slug: string
  plan: Plan
  subscription_status: SubscriptionStatus
  current_period_end: string | null
  updated_by_admin_id: string | null
  updated_at: string
  created_at: string
  /** Configuração do cardápio público (jsonb no Postgres). */
  theme?: unknown
}

export interface Menu {
  id: string
  restaurant_id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
}

export interface Category {
  id: string
  restaurant_id: string
  menu_id: string
  name: string
  created_at: string
}

export type ProductHighlightBadge = 'new' | 'bestseller' | 'special'

export interface Product {
  id: string
  restaurant_id: string
  menu_id: string
  category_id: string | null
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_available: boolean
  highlight_badge: ProductHighlightBadge | null
  created_at: string
}

export type ProductInsert = Omit<Product, 'id' | 'created_at'>
export type ProductUpdate = Partial<
  Pick<
    Product,
    'name' | 'description' | 'price' | 'image_url' | 'is_available' | 'category_id' | 'highlight_badge'
  >
>

export interface AdminRestaurantUsage {
  restaurant_id: string
  restaurant_name: string
  restaurant_slug: string
  user_id: string
  plan: Plan
  subscription_status: SubscriptionStatus
  current_period_end: string | null
  menus_count: number
  categories_count: number
  products_count: number
}

export interface AdminAuditLog {
  id: string
  admin_user_id: string
  restaurant_id: string
  action: string
  old_plan: Plan | null
  new_plan: Plan | null
  old_status: SubscriptionStatus | null
  new_status: SubscriptionStatus | null
  note: string | null
  created_at: string
}

export type SupportRequestType = 'plan' | 'support'
export type SupportNotificationStatus = 'new' | 'in_progress' | 'done'

export interface SupportNotification {
  id: string
  restaurant_id: string
  user_id: string
  request_type: SupportRequestType
  contact_whatsapp: string
  message: string
  status: SupportNotificationStatus
  created_at: string
  handled_at: string | null
  handled_by_admin_id: string | null
  restaurant_name?: string
}
