// Instagram 앱 딥링크로 스토리/피드 공유
// 앱에서 편집한 이미지를 IG 앱의 필터/편집 화면으로 넘김

type ShareResult = 'shared' | 'app_not_installed' | 'error';

async function canOpen(url: string): Promise<boolean> {
  try {
    const { Linking } = await import('react-native');
    return Linking.canOpenURL(url);
  } catch {
    return false;
  }
}

async function openUrl(url: string): Promise<void> {
  const { Linking } = await import('react-native');
  await Linking.openURL(url);
}

export const instagramShare = {
  async shareToStory(opts: {
    backgroundImageUri: string;
    stickerImageUri?: string;
    topColor?: string;
    bottomColor?: string;
  }): Promise<ShareResult> {
    const canOpenIG = await canOpen('instagram-stories://share');
    if (!canOpenIG) {
      try {
        await openUrl('https://www.instagram.com/');
      } catch { /* ignore */ }
      return 'app_not_installed';
    }

    try {
      // iOS: Pasteboard에 이미지 설정 후 딥링크 열기
      // Android: Intent로 이미지 전달
      const { Platform } = await import('react-native');

      if (Platform.OS === 'ios') {
        // expo-sharing 또는 react-native-share를 통해 이미지 전달
        const params = new URLSearchParams({
          'source_application': opts.backgroundImageUri,
        });
        if (opts.topColor) params.set('top_color', opts.topColor);
        if (opts.bottomColor) params.set('bottom_color', opts.bottomColor);
        await openUrl(`instagram-stories://share?${params}`);
      } else {
        // Android: Share Intent
        const { Share } = await import('react-native');
        await Share.share({ url: opts.backgroundImageUri }, { dialogTitle: 'Instagram Story에 공유' });
      }
      return 'shared';
    } catch {
      return 'error';
    }
  },

  async shareToFeed(opts: {
    localImageUri: string;
  }): Promise<ShareResult> {
    // 이미지를 카메라롤에 저장 → Instagram 앱의 라이브러리 화면으로 이동
    const canOpenIG = await canOpen('instagram://app');
    if (!canOpenIG) {
      try {
        await openUrl('https://www.instagram.com/');
      } catch { /* ignore */ }
      return 'app_not_installed';
    }

    try {
      // 먼저 이미지를 카메라롤에 저장 (expo-media-library는 peerDep)
      // @ts-expect-error dynamic import of optional peer dependency
      const MediaLibrary = await import('expo-media-library') as { requestPermissionsAsync: () => Promise<{ status: string }>; saveToLibraryAsync: (uri: string) => Promise<void> };
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') return 'error';
      await MediaLibrary.saveToLibraryAsync(opts.localImageUri);

      // Instagram 앱의 새 게시물 화면으로 이동
      await openUrl('instagram://library');
      return 'shared';
    } catch {
      return 'error';
    }
  },

  async isInstagramInstalled(): Promise<boolean> {
    return canOpen('instagram://app');
  },
};
