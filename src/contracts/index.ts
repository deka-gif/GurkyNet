// src/contracts/index.ts
import { User, Wallet, Banner, Product, Transaction, Notification, Profile, Pagination } from '../types';

/**
 * Standard Laravel API Resource Response Wrapper
 */
export interface LaravelResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * AuthResponse
 * Matches the structure of authentication response from Laravel (e.g. Sanctum/Passport)
 */
export interface AuthResponse extends LaravelResponse<{
  user: User;
  token?: string; // Optional if using Sanctum Cookie/Session auth, but present for bearer token fallback
  tokenType?: string;
  expiresIn?: number;
}> {}

/**
 * UserResponse
 * Single user details Laravel resource
 */
export interface UserResponse extends LaravelResponse<User> {}

/**
 * WalletResponse
 * Single wallet details Laravel resource
 */
export interface WalletResponse extends LaravelResponse<Wallet> {}

/**
 * BannerResponse
 * Banners list or single banner Laravel resource
 */
export interface BannerResponse extends LaravelResponse<Banner[]> {}

/**
 * ProductResponse
 * Product details or list of products with categories
 */
export interface ProductResponse extends LaravelResponse<Product | Product[]> {
  categories?: string[];
}

/**
 * TransactionResponse
 * Single transaction detail or list of transactions
 */
export interface TransactionResponse extends LaravelResponse<Transaction | Transaction[]> {
  pagination?: Pagination;
}

/**
 * NotificationResponse
 * Notifications list or mark read action response
 */
export interface NotificationResponse extends LaravelResponse<Notification[] | { readCount: number }> {}

/**
 * ProfileResponse
 * Profile details containing KYC, verification settings, and related User model
 */
export interface ProfileResponse extends LaravelResponse<Profile> {}

/**
 * PaginationResponse
 * Wrap standard Laravel length-aware pagination meta & links
 */
export interface PaginationResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    path: string;
    from: number | null;
    to: number | null;
  };
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
}

/**
 * ApiErrorResponse
 * Standard Laravel error response (e.g. 401, 403, 404, 500, 503)
 */
export interface ApiErrorResponse {
  success: false;
  message: string;
  error?: string;
  exception?: string; // Appears only in local/staging debug mode
  code?: string | number;
}

/**
 * ValidationErrorResponse
 * Standard Laravel 422 Unprocessable Entity error response structure
 */
export interface ValidationErrorResponse {
  success: false;
  message: string; // Typically: "The given data was invalid."
  errors: Record<string, string[]>; // Field names mapped to array of error strings
}

/**
 * API Endpoint Registry
 * Centralized registry of all endpoints mapping to Laravel API Routes
 */
export * from './apiEndpoints';
export * from './backendIntegrationChecklist';
