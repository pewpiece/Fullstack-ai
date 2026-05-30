export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface Inventory {
  id: string;
  name: string;
  description?: string;
  category_count: number;
  item_count: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  inventory_id: string;
  item_count: number;
  total_quantity: number;
  created_at: string;
}

export interface Item {
  id: string;
  name: string;
  sku: string;
  category_id: string;
  quantity: number;
  min_stock: number;
  price: number;
  cost: number;
  supplier?: string;
  unit: string;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
  image?: string;
  last_updated: string;
}

export interface DashboardStats {
  total_items: number;
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
  total_value: number;
  total_cost: number;
  inventory_count: number;
  category_count: number;
}

export interface ItemCreate {
  name: string;
  sku: string;
  category_id: string;
  quantity: number;
  min_stock: number;
  price: number;
  cost: number;
  supplier?: string;
  unit: string;
  status: Item['status'];
  image?: string;
}

export type ItemUpdate = ItemCreate;