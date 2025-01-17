export interface Config {
  targetUrl: string;
  refreshInterval: number;
  autoRetry: boolean;
  maxRetries: number;
  notificationEnabled: boolean;
  purchaseStrategy: PurchaseStrategy;
}

export interface PurchaseStrategy {
  autoPurchase: boolean;
  multiAccount: boolean;
  priceLimit?: boolean;
  maxPrice?: number;
  purchaseLimit?: {
    singleAccountLimit: number;
    quantityPerOrder: number;
  };
}

export interface Product {
  id: string;
  name: string;
  price: number;
  url: string;
  available: boolean;
}

export interface UserCredentials {
  username: string;
  password: string;
  isDefault?: boolean;
  orderCount?: number;
  hasPaymentInfo?: boolean;
}

export interface DeliveryInfo {
  country: string;
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
}

export interface PaymentInfo {
  accountId: string;
  delivery: DeliveryInfo;
  paymentMethod: 'credit-card' | 'alipay' | 'wechat-pay';
  creditCard?: {
    number: string;
    holder: string;
    expMonth: string;
    expYear: string;
    cvv: string;
  };
}

export interface PurchaseResult {
  success: boolean;
  error?: string;
  orderId?: string;
  timeTaken: number;
}

export interface StoredConfig extends Config {
  credentials?: string;
  paymentInfo?: string;
}

export interface ProxyConfig {
  protocol: 'http' | 'https' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
  failCount: number;
  averageResponseTime: number;
  lastUsed?: number;
}

export interface PurchaseTaskConfig {
  maxConcurrent: number;
  retryInterval: number;
  maxRetries: number;
  useProxy: boolean;
  proxyRotation: 'sequential' | 'random' | 'performance';
}

export interface PurchaseAttempt {
  timestamp: number;
  productId: string;
  accountId: string;
  proxyId?: string;
  success: boolean;
  error?: string;
  timeTaken: number;
  retryCount: number;
}

export type CaptchaType = 'image' | 'slider' | 'click' | 'none';

export interface CaptchaInfo {
  type: CaptchaType;
  imageUrl?: string;
  elementSelector?: string;
  data?: any;
}

export interface CaptchaSolution {
  type: CaptchaType;
  value: string | number[] | { x: number; y: number }[];
  success: boolean;
}

export interface MonitorConfig {
  targetUrl: string;
  refreshInterval: number;
  autoRetry: boolean;
  maxRetries: number;
  notificationEnabled: boolean;
  purchaseStrategy: {
    multiAccount: boolean;
    priceLimit: boolean;
    maxPrice: number;
    priority: string;
    autoPurchase: boolean;
  };
}

export interface Zone {
  code: string;
  name: string;
}

export interface CountryData {
  Zones: Zone[];
}

export interface PurchaseSettings {
  singleAccountLimit: number;
  quantityPerOrder: number;
} 