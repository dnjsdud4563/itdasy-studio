# Meta Data Use Checkup - Submission Document

> App Name: Beauty Platform
> Meta App ID: (to be assigned upon submission)
> Last Updated: 2026-04-16

## 1. App Overview

**Beauty Platform** is a Korean beauty and skincare application that allows users to connect their Instagram accounts to import portfolio content for their beauty business profiles. The app provides AI-powered skin analysis (educational only), beauty content management, and Instagram feed integration for beauty professionals.

---

## 2. Permissions Requested

### 2.1 instagram_basic

| Field | Details |
|---|---|
| **Permission** | `instagram_basic` |
| **Business Justification** | Required to authenticate Instagram users and retrieve their basic profile information (username, profile picture, account type). This data is used to populate the user's beauty professional profile within the app and verify account ownership. |
| **Screenshot Description** | Profile settings screen showing the "Instagram 계정 연결" (Connect Instagram Account) button. Upon connection, the user's Instagram username and profile picture are displayed in the app's profile header section. |
| **Data Retention Policy** | Instagram username and profile picture URL are stored in Supabase for the duration of the account's active status. Data is deleted within 30 days of account deletion or Instagram disconnection. Profile picture is not cached locally beyond the current session. |

### 2.2 user_profile

| Field | Details |
|---|---|
| **Permission** | `user_profile` |
| **Business Justification** | Required to display the user's Instagram display name and biography within their Beauty Platform professional profile. Beauty professionals use this to maintain a consistent brand identity across their Instagram presence and in-app portfolio. |
| **Screenshot Description** | The "My Profile" tab showing the imported Instagram display name and bio text rendered below the user's profile picture. An edit icon allows the user to customize the imported data. |
| **Data Retention Policy** | Display name and biography text are stored in Supabase and synced on each app login. Users can manually override imported data at any time. All imported profile data is purged within 30 days of account deletion. |

### 2.3 user_media

| Field | Details |
|---|---|
| **Permission** | `user_media` |
| **Business Justification** | Required to allow beauty professionals to import their Instagram posts (images and captions) into their in-app portfolio. This is a core feature: users curate selected Instagram content to build their beauty service portfolio visible to potential clients. |
| **Screenshot Description** | The "Portfolio Import" screen showing a grid of the user's recent Instagram posts with checkboxes. Selected posts are imported into the app's portfolio section with their original captions and images. |
| **Data Retention Policy** | Imported media URLs and captions are stored in Supabase. Images are referenced by Instagram CDN URL and not duplicated to our storage unless the user explicitly saves them to their portfolio. Imported media references are deleted within 30 days of account deletion. Users can remove individual imported posts at any time. |

---

## 3. Data Deletion

### Callback Configuration

| Field | Value |
|---|---|
| **Callback URL** | `POST /v1/meta/data-deletion` |
| **HTTP Method** | POST |
| **Content-Type** | `application/json` |
| **Response Format** | JSON with `url` and `confirmation_code` fields |

### Deletion Process

1. Meta sends a signed request to `POST /v1/meta/data-deletion` containing the user's Facebook/Instagram ID.
2. The server verifies the request signature using the App Secret.
3. All data associated with the user's Instagram account is queued for deletion:
   - Profile information (username, display name, bio)
   - Imported media references
   - Authentication tokens
4. A confirmation code and status URL are returned to Meta.
5. Deletion is completed within 30 days. The status URL returns `{ "status": "complete" }` once finished.

### Response Example

```json
{
  "url": "https://api.beautyplatform.app/v1/meta/data-deletion/status?id=abc123",
  "confirmation_code": "abc123"
}
```

---

## 4. Privacy Policy

| Field | Value |
|---|---|
| **Privacy Policy URL** | Served via `serve-legal` Supabase Edge Function |
| **Languages** | Korean (primary), English |
| **Covers** | Instagram data usage, AI analysis data, user-generated content |

---

## 5. Data Sharing Declaration

| Recipient | Data Shared | Purpose |
|---|---|---|
| **Third parties for advertising** | **None** | No Instagram data or any user data is shared with third parties for advertising purposes. |
| **Supabase (Database)** | Profile data, media references | Core app functionality (data storage) |
| **HuggingFace (AI)** | Anonymized image features only | AI skin analysis processing. No PII (usernames, Instagram IDs) is sent. |

---

## 6. App Review Notes for Meta

- The app does not post content to Instagram on behalf of the user.
- The app does not use Instagram data for advertising, marketing to third parties, or data brokering.
- All Instagram API calls are server-side via the Graph API. No client-side SDK token storage.
- Users must explicitly grant permission via the OAuth flow before any data is accessed.
- Users can disconnect their Instagram account and trigger data deletion at any time from the app settings.
