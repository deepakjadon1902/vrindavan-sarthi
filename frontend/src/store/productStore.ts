import { create } from 'zustand';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import axios from 'axios';
import { publishAppEvent } from '@/lib/broadcast';

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
  id: string; // Mongo _id
  orderId: string; // human-friendly code like ORD-...
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

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const getString = (obj: Record<string, unknown>, key: string) => (typeof obj[key] === 'string' ? obj[key] : '');
const getNumber = (obj: Record<string, unknown>, key: string) => (typeof obj[key] === 'number' ? obj[key] : Number(obj[key] || 0));
const getBoolean = (obj: Record<string, unknown>, key: string) => (typeof obj[key] === 'boolean' ? obj[key] : Boolean(obj[key]));
const getStringArray = (obj: Record<string, unknown>, key: string) => {
  const v = obj[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
};

const normalizeProduct = (p: unknown): Product => {
  const obj = isRecord(p) ? p : {};
  return {
    id: getString(obj, '_id') || getString(obj, 'id'),
    name: getString(obj, 'name'),
    description: getString(obj, 'description'),
    price: getNumber(obj, 'price'),
    category: getString(obj, 'category'),
    images: getStringArray(obj, 'images'),
    inStock: getBoolean(obj, 'inStock'),
    createdAt: getString(obj, 'createdAt') || new Date().toISOString(),
  };
};

const normalizeOrder = (o: unknown): Order => {
  const obj = isRecord(o) ? o : {};
  const productIdObj = isRecord(obj.productId) ? obj.productId : {};
  const userIdObj = isRecord(obj.userId) ? obj.userId : {};

  const paymentStatusRaw = getString(obj, 'paymentStatus');
  const paymentStatus: Order['paymentStatus'] =
    paymentStatusRaw === 'paid' || paymentStatusRaw === 'failed' || paymentStatusRaw === 'pending' ? paymentStatusRaw : 'pending';

  const orderStatusRaw = getString(obj, 'orderStatus');
  const orderStatus: Order['orderStatus'] =
    orderStatusRaw === 'confirmed' || orderStatusRaw === 'shipped' || orderStatusRaw === 'delivered' || orderStatusRaw === 'cancelled' || orderStatusRaw === 'pending'
      ? orderStatusRaw
      : 'pending';

  return {
    id: getString(obj, '_id') || getString(obj, 'id'),
    orderId: getString(obj, 'orderId'),
    productId: getString(productIdObj, '_id') || getString(obj, 'productId'),
    productName: getString(obj, 'productName'),
    productImage: getString(obj, 'productImage'),
    productPrice: getNumber(obj, 'productPrice'),
    quantity: getNumber(obj, 'quantity') || 1,
    totalAmount: getNumber(obj, 'totalAmount'),
    userId: getString(userIdObj, '_id') || getString(obj, 'userId'),
    userName: getString(obj, 'userName'),
    userEmail: getString(obj, 'userEmail'),
    userPhone: getString(obj, 'userPhone'),
    shippingAddress: getString(obj, 'shippingAddress'),
    paymentStatus,
    orderStatus,
    upiTransactionId: getString(obj, 'upiTransactionId') || undefined,
    createdAt: getString(obj, 'createdAt') || new Date().toISOString(),
  };
};

const getApiErrorMessage = (err: unknown, fallback: string) => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (isRecord(data) && typeof data.message === 'string') return data.message;
    return err.message || fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
};

interface ProductState {
  products: Product[];
  myOrders: Order[];
  adminOrders: Order[];
  isLoadingProducts: boolean;
  isLoadingOrders: boolean;
  fetchProducts: () => Promise<void>;
  fetchProductById: (id: string) => Promise<Product | null>;
  fetchAdminProducts: () => Promise<void>;
  createProduct: (product: Omit<Product, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: string }>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<{ success: boolean; error?: string }>;
  deleteProduct: (id: string) => Promise<{ success: boolean; error?: string }>;

  createOrder: (order: Omit<Order, 'id' | 'orderId' | 'createdAt' | 'userId'>) => Promise<{ success: boolean; data?: Order; error?: string }>;
  fetchMyOrders: () => Promise<void>;
  fetchAllOrders: () => Promise<void>;
  verifyOrderPayment: (id: string) => Promise<{ success: boolean; error?: string }>;
  rejectOrderPayment: (id: string) => Promise<{ success: boolean; error?: string }>;
  updateOrderStatus: (id: string, status: Order['orderStatus']) => Promise<{ success: boolean; error?: string }>;
}

export const useProductStore = create<ProductState>()((set, get) => ({
  products: [],
  myOrders: [],
  adminOrders: [],
  isLoadingProducts: false,
  isLoadingOrders: false,

  fetchProducts: async () => {
    try {
      set({ isLoadingProducts: true });
      const res = await api.get('/products');
      const products = (res.data?.data || []).map(normalizeProduct);
      set({ products, isLoadingProducts: false });
    } catch {
      set({ isLoadingProducts: false });
    }
  },

  fetchProductById: async (id) => {
    if (!id) return null;
    const existing = get().products.find((p) => p.id === id);
    if (existing) return existing;
    try {
      const res = await api.get(`/products/${id}`);
      const product = normalizeProduct(res.data?.data);
      if (!product.id) return null;
      set((state) => ({ products: [product, ...state.products.filter((p) => p.id !== product.id)] }));
      return product;
    } catch {
      return null;
    }
  },

  fetchAdminProducts: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    try {
      set({ isLoadingProducts: true });
      const res = await api.get('/products/all', withAuth(token));
      const products = (res.data?.data || []).map(normalizeProduct);
      set({ products, isLoadingProducts: false });
    } catch {
      set({ isLoadingProducts: false });
    }
  },

  createProduct: async (product) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await api.post('/products', product, withAuth(token));
      const created = normalizeProduct(res.data?.data);
      set((state) => ({ products: [created, ...state.products] }));
      publishAppEvent('product:changed');
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: getApiErrorMessage(err, 'Create failed') };
    }
  },

  updateProduct: async (id, data) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await api.put(`/products/${id}`, data, withAuth(token));
      const updated = normalizeProduct(res.data?.data);
      set((state) => ({ products: state.products.map((p) => (p.id === id ? updated : p)) }));
      publishAppEvent('product:changed');
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: getApiErrorMessage(err, 'Update failed') };
    }
  },

  deleteProduct: async (id) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      await api.delete(`/products/${id}`, withAuth(token));
      set((state) => ({ products: state.products.filter((p) => p.id !== id) }));
      publishAppEvent('product:changed');
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: getApiErrorMessage(err, 'Delete failed') };
    }
  },

  createOrder: async (order) => {
    const token = useAuthStore.getState().token;
    const user = useAuthStore.getState().user;
    if (!token || !user) return { success: false, error: 'Not authenticated' };
    try {
      const res = await api.post('/orders', order, withAuth(token));
      const created = normalizeOrder(res.data?.data);
      set((state) => ({ myOrders: [created, ...state.myOrders] }));
      return { success: true, data: created };
    } catch (err: unknown) {
      return { success: false, error: getApiErrorMessage(err, 'Order failed') };
    }
  },

  fetchMyOrders: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    try {
      set({ isLoadingOrders: true });
      const res = await api.get('/orders/my', withAuth(token));
      const myOrders = (res.data?.data || []).map(normalizeOrder);
      set({ myOrders, isLoadingOrders: false });
    } catch {
      set({ isLoadingOrders: false });
    }
  },

  fetchAllOrders: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    try {
      set({ isLoadingOrders: true });
      const res = await api.get('/orders/all', withAuth(token));
      const adminOrders = (res.data?.data || []).map(normalizeOrder);
      set({ adminOrders, isLoadingOrders: false });
    } catch {
      set({ isLoadingOrders: false });
    }
  },

  verifyOrderPayment: async (id) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await api.put(`/orders/${id}/verify`, {}, withAuth(token));
      const updated = normalizeOrder(res.data?.data);
      set((state) => ({ adminOrders: state.adminOrders.map((o) => (o.id === id ? updated : o)) }));
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: getApiErrorMessage(err, 'Verify failed') };
    }
  },

  rejectOrderPayment: async (id) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await api.put(`/orders/${id}/reject`, {}, withAuth(token));
      const updated = normalizeOrder(res.data?.data);
      set((state) => ({ adminOrders: state.adminOrders.map((o) => (o.id === id ? updated : o)) }));
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: getApiErrorMessage(err, 'Reject failed') };
    }
  },

  updateOrderStatus: async (id, status) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await api.put(`/orders/${id}/status`, { status }, withAuth(token));
      const updated = normalizeOrder(res.data?.data);
      set((state) => ({ adminOrders: state.adminOrders.map((o) => (o.id === id ? updated : o)) }));
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: getApiErrorMessage(err, 'Update failed') };
    }
  },
}));
