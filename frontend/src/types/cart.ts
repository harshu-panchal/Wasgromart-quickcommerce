import { Product } from './domain';

export interface CartItem {
  product: Product;
  quantity: number;
  variant?: any;
}

export interface Cart {
  items: CartItem[];
  total: number;
  itemCount: number;
  estimatedDeliveryFee?: number;
  platformFee?: number;
  freeDeliveryThreshold?: number;
}

