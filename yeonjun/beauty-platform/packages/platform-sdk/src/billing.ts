import { api, getOptions } from './client';
import type { Entitlements } from './types';

type PurchasesModule = typeof import('react-native-purchases');
let _rc: PurchasesModule['default'] | null = null;

async function rc(): Promise<PurchasesModule['default']> {
  if (_rc) return _rc;
  const mod = (await import('react-native-purchases')) as PurchasesModule;
  _rc = mod.default;
  return _rc;
}

async function platformOS(): Promise<'ios' | 'android' | 'web'> {
  try {
    const RN = (await import('react-native')) as typeof import('react-native');
    return RN.Platform.OS as 'ios' | 'android' | 'web';
  } catch {
    return 'web';
  }
}

export const billing = {
  async configure(userId: string) {
    const opts = getOptions();
    const os = await platformOS();
    const key = os === 'ios' ? opts.revenueCatKeyIos : opts.revenueCatKeyAndroid;
    if (!key) throw new Error('RevenueCat key not provided in init()');
    const P = await rc();
    await P.configure({ apiKey: key, appUserID: userId });
  },

  async entitlements(): Promise<Entitlements> {
    return api<Entitlements>('/v1/billing/entitlements');
  },

  async canUseFeature(feature: string): Promise<boolean> {
    const e = await this.entitlements();
    if (e.plan !== 'free') return true;
    if (feature === 'ai_generation') return e.creditsRemaining > 0;
    return e.features.includes(feature);
  },

  async restorePurchases(): Promise<boolean> {
    const P = await rc();
    const info = await P.restorePurchases();
    const hasActive = Object.keys(info.entitlements.active).length > 0;
    return hasActive;
  },

  async presentPaywall(opts: { offering?: string } = {}): Promise<'purchased' | 'cancelled' | 'error'> {
    const P = await rc();
    const offerings = await P.getOfferings();
    const target = opts.offering ? offerings.all[opts.offering] : offerings.current;
    if (!target) return 'error';
    const pkg = target.availablePackages[0];
    if (!pkg) return 'error';
    try {
      await P.purchasePackage(pkg);
      return 'purchased';
    } catch (e) {
      const err = e as { userCancelled?: boolean };
      return err.userCancelled ? 'cancelled' : 'error';
    }
  },
};
