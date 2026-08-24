import type {
  AdminAuditLog,
  AdminRestaurantUsage,
  Category,
  Menu,
  Plan,
  Product,
  ProductInsert,
  ProductUpdate,
  Restaurant,
  SubscriptionStatus,
  SupportNotification,
  SupportNotificationStatus,
  SupportRequestType,
} from '@/types/database'
import type { RestaurantTheme } from '@/types/theme'
import { apiRequest } from './api'

export async function fetchMyRestaurant(): Promise<Restaurant | null> {
  const data = await apiRequest<{ restaurant: Restaurant | null }>('/restaurants/me')
  return data.restaurant
}

export async function fetchRestaurantBySlug(slug: string): Promise<Restaurant | null> {
  const data = await apiRequest<{ restaurant: Restaurant | null }>(
    `/restaurants/by-slug/${encodeURIComponent(slug)}`,
    { auth: false },
  )
  return data.restaurant
}

export async function createRestaurant(input: {
  name: string
  slug: string
}): Promise<Restaurant> {
  const data = await apiRequest<{ restaurant: Restaurant }>('/restaurants', {
    body: { name: input.name.trim(), slug: input.slug },
  })
  return data.restaurant
}

export async function updateMyRestaurant(input: {
  name: string
  slug: string
}): Promise<Restaurant> {
  const data = await apiRequest<{ restaurant: Restaurant }>('/restaurants/me', {
    method: 'PATCH',
    body: { name: input.name.trim(), slug: input.slug.trim().toLowerCase() },
  })
  return data.restaurant
}

export async function updateMyRestaurantTheme(theme: RestaurantTheme): Promise<Restaurant> {
  const data = await apiRequest<{ restaurant: Restaurant }>('/restaurants/me/theme', {
    method: 'PATCH',
    body: { theme },
  })
  return data.restaurant
}

export async function uploadRestaurantLogo(restaurantId: string, file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  form.append('restaurantId', restaurantId)
  const data = await apiRequest<{ url: string }>('/uploads', { formData: form })
  return data.url
}

export async function uploadRestaurantBanner(restaurantId: string, file: File): Promise<string> {
  return uploadRestaurantLogo(restaurantId, file)
}

export async function fetchAllRestaurantsAdmin(): Promise<AdminRestaurantUsage[]> {
  const data = await apiRequest<{ restaurants: AdminRestaurantUsage[] }>('/admin/restaurants')
  return data.restaurants
}

export async function adminSetRestaurantPlan(restaurantId: string, plan: Plan): Promise<void> {
  await adminSetRestaurantPlanStatus({
    restaurantId,
    plan,
    status: 'manual',
  })
}

export async function adminSetRestaurantPlanStatus(input: {
  restaurantId: string
  plan: Plan
  status: SubscriptionStatus
  periodEnd?: string | null
  note?: string | null
}): Promise<void> {
  await apiRequest(`/admin/restaurants/${input.restaurantId}/plan-status`, {
    body: {
      plan: input.plan,
      status: input.status,
      periodEnd: input.periodEnd ?? null,
      note: input.note ?? null,
    },
  })
}

export async function fetchAdminAuditLogs(restaurantId: string): Promise<AdminAuditLog[]> {
  const data = await apiRequest<{ logs: AdminAuditLog[] }>(
    `/admin/restaurants/${restaurantId}/audit-logs`,
  )
  return data.logs
}

export async function fetchMenus(
  restaurantId: string,
  opts?: { asPublicVisitor?: boolean },
): Promise<Menu[]> {
  const q = opts?.asPublicVisitor ? '?public=1' : ''
  const data = await apiRequest<{ menus: Menu[] }>(
    `/restaurants/${restaurantId}/menus${q}`,
    { auth: !opts?.asPublicVisitor },
  )
  return data.menus
}

export async function createMenu(input: {
  restaurant_id: string
  name: string
  slug: string
  is_active?: boolean
}): Promise<Menu> {
  const data = await apiRequest<{ menu: Menu }>(`/restaurants/${input.restaurant_id}/menus`, {
    body: {
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      is_active: input.is_active ?? false,
    },
  })
  return data.menu
}

export async function updateMenu(
  id: string,
  patch: Partial<Pick<Menu, 'name' | 'is_active'>>,
): Promise<Menu> {
  const data = await apiRequest<{ menu: Menu }>(`/menus/${id}`, {
    method: 'PATCH',
    body: patch,
  })
  return data.menu
}

export async function deleteMenu(id: string): Promise<void> {
  await apiRequest(`/menus/${id}`, { method: 'DELETE' })
}

export async function fetchCategories(
  restaurantId: string,
  menuId?: string,
  opts?: { asPublicVisitor?: boolean },
): Promise<Category[]> {
  const params = new URLSearchParams()
  if (menuId) params.set('menuId', menuId)
  if (opts?.asPublicVisitor) params.set('public', '1')
  const q = params.toString() ? `?${params}` : ''
  const data = await apiRequest<{ categories: Category[] }>(
    `/restaurants/${restaurantId}/categories${q}`,
    { auth: !opts?.asPublicVisitor },
  )
  return data.categories
}

export async function createCategory(
  restaurantId: string,
  menuId: string,
  name: string,
): Promise<Category> {
  const data = await apiRequest<{ category: Category }>(
    `/restaurants/${restaurantId}/categories`,
    { body: { menu_id: menuId, name: name.trim() } },
  )
  return data.category
}

export async function updateCategory(id: string, name: string): Promise<Category> {
  const data = await apiRequest<{ category: Category }>(`/categories/${id}`, {
    method: 'PATCH',
    body: { name: name.trim() },
  })
  return data.category
}

export async function deleteCategory(id: string): Promise<void> {
  await apiRequest(`/categories/${id}`, { method: 'DELETE' })
}

export async function fetchProducts(
  restaurantId: string,
  menuId?: string,
  opts?: { asPublicVisitor?: boolean },
): Promise<Product[]> {
  const params = new URLSearchParams()
  if (menuId) params.set('menuId', menuId)
  if (opts?.asPublicVisitor) params.set('public', '1')
  const q = params.toString() ? `?${params}` : ''
  const data = await apiRequest<{ products: Product[] }>(
    `/restaurants/${restaurantId}/products${q}`,
    { auth: !opts?.asPublicVisitor },
  )
  return data.products
}

export async function uploadProductImage(restaurantId: string, file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  form.append('restaurantId', restaurantId)
  const data = await apiRequest<{ url: string }>('/uploads', { formData: form })
  return data.url
}

export async function createProduct(row: ProductInsert): Promise<Product> {
  const data = await apiRequest<{ product: Product }>(
    `/restaurants/${row.restaurant_id}/products`,
    {
      body: {
        menu_id: row.menu_id,
        category_id: row.category_id,
        name: row.name,
        description: row.description,
        price: row.price,
        image_url: row.image_url,
        is_available: row.is_available,
        highlight_badge: row.highlight_badge ?? null,
      },
    },
  )
  return data.product
}

export async function updateProduct(id: string, patch: ProductUpdate): Promise<Product> {
  const data = await apiRequest<{ product: Product }>(`/products/${id}`, {
    method: 'PATCH',
    body: patch,
  })
  return data.product
}

export async function deleteProduct(id: string): Promise<void> {
  await apiRequest(`/products/${id}`, { method: 'DELETE' })
}

export async function createSupportNotification(input: {
  restaurantId: string
  requestType: SupportRequestType
  contactWhatsapp: string
  message: string
}): Promise<SupportNotification> {
  const data = await apiRequest<{ notification: SupportNotification }>('/support', {
    body: {
      restaurantId: input.restaurantId,
      requestType: input.requestType,
      contactWhatsapp: input.contactWhatsapp,
      message: input.message,
    },
  })
  return data.notification
}

export async function fetchSupportNotificationsAdmin(): Promise<SupportNotification[]> {
  const data = await apiRequest<{ notifications: SupportNotification[] }>('/support')
  return data.notifications
}

export async function fetchMySupportNotifications(): Promise<SupportNotification[]> {
  const data = await apiRequest<{ notifications: SupportNotification[] }>('/support/me')
  return data.notifications
}

export async function updateSupportNotificationStatus(
  id: string,
  status: SupportNotificationStatus,
): Promise<void> {
  await apiRequest(`/support/${id}/status`, {
    method: 'PATCH',
    body: { status },
  })
}

export async function fetchIsPlatformAdmin(): Promise<boolean> {
  try {
    const data = await apiRequest<{ isPlatformAdmin: boolean }>('/auth/me')
    return Boolean(data.isPlatformAdmin)
  } catch {
    return false
  }
}
