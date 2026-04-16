export type Plan = 'free' | 'premium_monthly' | 'premium_yearly';

export interface InitOptions {
  baseUrl: string;
  anonKey: string;
  revenueCatKeyIos?: string;
  revenueCatKeyAndroid?: string;
}

export interface Profile {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  plan: Plan;
  creditsRemaining: number;
  createdAt: string;
}

export interface Entitlements {
  plan: Plan;
  source: 'revenuecat' | 'portone' | 'none';
  renewAt: string | null;
  creditsRemaining: number;
  features: string[];
}

export interface GenerateImageOptions {
  prompt: string;
  style?: 'natural' | 'glam' | 'vintage' | 'kbeauty';
  referenceImageUrl?: string;
}

export interface GenerateImageResult {
  generationId: string;
  imageUrl: string;
  thumbnailUrl: string;
  creditsRemaining: number;
  latencyMs: number;
}

export interface GalleryItem {
  id: string;
  imageUrl: string;
  thumbnailUrl: string;
  prompt: string;
  style: string;
  createdAt: string;
}
