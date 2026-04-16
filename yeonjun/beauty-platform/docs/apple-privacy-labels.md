# Apple Privacy Nutrition Labels

> App: Beauty Platform
> Bundle ID: (to be assigned)
> Last Updated: 2026-04-16

## Overview

This document maps all data collection and usage within Beauty Platform to Apple's App Privacy ("Nutrition Label") requirements for App Store Connect submission.

---

## Data Collection Summary

| Data Type | Collected | Linked to User | Used for Tracking | Purpose |
|---|---|---|---|---|
| Email Address | Yes | Yes | No | App Functionality (account creation, login) |
| Name | Yes (optional) | Yes | No | App Functionality (profile display name) |
| Photos | Yes | Yes | No | App Functionality (skin analysis, portfolio) |
| Usage Data | Yes | No | No | Analytics (app improvement, crash reporting) |
| Device ID (Push Token) | Yes | Yes | No | App Functionality (push notifications) |
| Instagram Username | Yes (when connected) | Yes | No | App Functionality (profile integration) |
| Instagram Profile Picture | Yes (when connected) | Yes | No | App Functionality (profile display) |

---

## Detailed Data Type Breakdown

### Contact Info

| Sub-type | Collected | Details |
|---|---|---|
| Email Address | Yes | Required for account creation via Supabase Auth. Linked to user identity. Used solely for authentication and transactional emails (password reset, account verification). |
| Name | Optional | Display name for the user's beauty professional profile. User-provided. Can be edited or removed at any time. |
| Phone Number | No | Not collected via iOS app. |

### Photos or Videos

| Sub-type | Collected | Details |
|---|---|---|
| Photos | Yes | Users upload photos for AI skin analysis and portfolio content. Photos are processed server-side and stored in Supabase Storage. Used exclusively for app functionality. |
| Videos | No | Not collected. |

### Identifiers

| Sub-type | Collected | Details |
|---|---|---|
| Device ID (Push Token) | Yes | APNs push token collected for push notification delivery. Linked to user for notification targeting (e.g., analysis results ready). Not used for tracking. |
| User ID | Yes | Internal Supabase UUID. Linked to user. Used for app functionality only. |
| IDFA | **No** | Not collected. See ATT exemption note below. |

### Usage Data

| Sub-type | Collected | Details |
|---|---|---|
| Product Interaction | Yes | Feature usage patterns (which screens visited, features used). Collected anonymously for analytics. Not linked to user identity. |
| Crash Data | Yes | Crash logs for stability improvement. Not linked to user identity. |

### Third-Party Platform Data (Instagram)

| Sub-type | Collected | Details |
|---|---|---|
| Instagram Username | Yes (opt-in) | Collected only when the user explicitly connects their Instagram account. Stored in Supabase. Linked to user. |
| Instagram Profile Picture | Yes (opt-in) | URL reference only. Referenced from Instagram CDN, not duplicated. Linked to user. |
| Instagram Media | Yes (opt-in) | Media URLs and captions for user-selected posts. Imported to portfolio. Linked to user. |

---

## Camera and Photo Library Permission Strings

### Camera (`NSCameraUsageDescription`)

```
피부 분석을 위해 카메라로 사진을 촬영합니다. 촬영된 사진은 AI 피부 특성 분석에 사용되며, 의료적 진단 목적이 아닌 일반 정보 제공용입니다.
```

English:
```
The camera is used to take photos for skin analysis. Photos are used for AI skin characteristic analysis and provide general information only, not medical diagnosis.
```

### Photo Library (`NSPhotoLibraryUsageDescription`)

```
피부 분석 및 포트폴리오에 사용할 사진을 선택하기 위해 사진 라이브러리에 접근합니다.
```

English:
```
Access to the photo library is required to select photos for skin analysis and portfolio content.
```

### Photo Library Add (`NSPhotoLibraryAddUsageDescription`)

```
AI 분석 결과 이미지를 사진 라이브러리에 저장합니다.
```

English:
```
Used to save AI analysis result images to your photo library.
```

---

## ATT (App Tracking Transparency) Exemption Note

Beauty Platform does **NOT** use IDFA or any device-level advertising identifier. All Instagram integration is performed server-side via the Meta Graph API. No client-side tracking SDKs are embedded.

**ATT Status: Exempt** - The `ATTrackingManager.requestTrackingAuthorization()` prompt is NOT required because:

1. No IDFA collection
2. No third-party advertising SDKs
3. No cross-app or cross-site tracking
4. Server-side Graph API calls only (no Facebook SDK client-side)
5. Analytics data is not linked to user identity and not shared with third parties

---

## Tracking Definition Compliance

Per Apple's definition, "tracking" refers to linking user or device data with third-party data for targeted advertising or sharing with data brokers. Beauty Platform performs **none** of these activities.

---

## References

- [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
- [App Tracking Transparency](https://developer.apple.com/documentation/apptrackingtransparency)
