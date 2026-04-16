// App Tracking Transparency (iOS) — Meta SDK 추적 시 필수
// 보고서 6.3절: ATT 프레임워크로 사전 동의 팝업

export const tracking = {
  async requestPermission(): Promise<'authorized' | 'denied' | 'not-determined' | 'restricted'> {
    try {
      // @ts-expect-error optional peer dependency
      const mod = await import('expo-tracking-transparency');
      const { status } = await mod.requestTrackingPermissionsAsync();
      return status as 'authorized' | 'denied' | 'not-determined' | 'restricted';
    } catch {
      return 'authorized';
    }
  },

  async getStatus(): Promise<string> {
    try {
      // @ts-expect-error optional peer dependency
      const mod = await import('expo-tracking-transparency');
      const { status } = await mod.getTrackingPermissionsAsync();
      return status as string;
    } catch {
      return 'authorized';
    }
  },
};
