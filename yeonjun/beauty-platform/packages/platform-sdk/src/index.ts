import { setOptions } from './client';
import type { InitOptions } from './types';
import { auth } from './auth';
import { profile } from './profile';
import { ai } from './ai';
import { gallery } from './gallery';
import { storage } from './storage';
import { billing } from './billing';
import { account, push } from './account';
import { rating } from './rating';
import { meta } from './meta';
import { instagramShare } from './instagram-share';
import { imageTools } from './image-tools';
import { tracking } from './tracking';
import { community } from './moderation';

export const BeautyPlatform = {
  init(opts: InitOptions) {
    setOptions(opts);
  },
  auth,
  profile,
  ai,
  gallery,
  storage,
  billing,
  account,
  push,
  rating,
  meta,
  instagramShare,
  imageTools,
  tracking,
  community,
};

export type { InitOptions, Profile, Entitlements, GenerateImageOptions, GenerateImageResult, GalleryItem, Plan } from './types';
