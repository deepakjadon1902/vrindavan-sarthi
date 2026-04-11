import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  images: string[];
  inStock: boolean;
  createdAt: string;
}

export interface Order {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  productPrice: number;
  quantity: number;
  totalAmount: number;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  shippingAddress: string;
  paymentStatus: 'pending' | 'paid' | 'failed';
  orderStatus: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  upiTransactionId?: string;
  createdAt: string;
}

interface ProductState {
  products: Product[];
  orders: Order[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addOrder: (order: Omit<Order, 'id' | 'createdAt'>) => Order;
  verifyOrderPayment: (id: string) => void;
  rejectOrderPayment: (id: string) => void;
  updateOrderStatus: (id: string, status: Order['orderStatus']) => void;
  getOrdersByUser: (userId: string) => Order[];
  getAllOrders: () => Order[];
}

export const useProductStore = create<ProductState>()(
  persist(
    (set, get) => ({
      products: [],
      orders: [],

      addProduct: (data) => {
        const product: Product = {
          ...data,
          id: `prod-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ products: [...state.products, product] }));
      },

      updateProduct: (id, data) => {
        set((state) => ({
          products: state.products.map((p) => (p.id === id ? { ...p, ...data } : p)),
        }));
      },

      deleteProduct: (id) => {
        set((state) => ({ products: state.products.filter((p) => p.id !== id) }));
      },

      addOrder: (data) => {
        const order: Order = {
          ...data,
          id: `ORD-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ orders: [...state.orders, order] }));
        return order;
      },

      verifyOrderPayment: (id) => {
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id ? { ...o, paymentStatus: 'paid' as const, orderStatus: 'confirmed' as const } : o
          ),
        }));
      },

      rejectOrderPayment: (id) => {
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id ? { ...o, paymentStatus: 'failed' as const, orderStatus: 'cancelled' as const } : o
          ),
        }));
      },

      updateOrderStatus: (id, status) => {
        set((state) => ({
          orders: state.orders.map((o) => (o.id === id ? { ...o, orderStatus: status } : o)),
        }));
      },

      getOrdersByUser: (userId) => get().orders.filter((o) => o.userId === userId),
      getAllOrders: () => get().orders,
    }),
    { name: 'vvs-products' }
  )
);
