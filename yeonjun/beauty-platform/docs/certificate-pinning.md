# Certificate Pinning 가이드 (MITM 방어)

## 왜 필요한가
HTTPS만으로는 중간자 공격(MITM)을 완벽히 방어 못 함. 공격자가 조작된 WiFi + 가짜 인증서를 쓰면 트래픽을 가로챌 수 있음. 인증서 피닝은 우리 서버의 인증서 해시값을 앱에 내장해서, 가짜 인증서로의 통신을 원천 차단.

## React Native 구현

### expo-certificate-transparency (Expo)
```bash
npx expo install expo-certificate-transparency
```

### react-native-ssl-pinning (Bare RN)
```bash
npm install react-native-ssl-pinning
```

```typescript
import { fetch as pinnedFetch } from 'react-native-ssl-pinning';

const res = await pinnedFetch(url, {
  method: 'GET',
  sslPinning: {
    certs: ['our-server-cert'], // DER 인증서를 assets에 포함
  },
});
```

## 인증서 해시 추출
```bash
# 서버 배포 후 실행
echo | openssl s_client -connect api.beauty-platform.com:443 2>/dev/null | \
  openssl x509 -pubkey -noout | \
  openssl pkey -pubin -outform der | \
  openssl dgst -sha256 -binary | base64
```
출력된 base64 해시값을 앱에 내장.

## 주의사항
- 인증서 갱신(Let's Encrypt 90일) 시 앱도 업데이트 필요 → **공개 키 피닝** 권장 (인증서보다 안정)
- 디버그 빌드에서는 피닝 비활성화 (Charles Proxy 디버깅 가능하도록)
- 프로덕션 빌드에서만 활성화

## 적용 시점
- MVP에서는 선택사항 (Tier 3)
- 유료 구독자 데이터 보호가 중요해지면 적용
