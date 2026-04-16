# Google Play Data Safety Form Mapping

> App: Beauty Platform
> Package Name: (to be assigned)
> Last Updated: 2026-04-16

## Overview

This document maps all data collection, sharing, and security practices for the Google Play Data Safety form submission.

---

## 1. Data Collection

### Does your app collect or share any of the required user data types?

**Yes**

### Is all collected data encrypted in transit?

**Yes** - All network communication uses HTTPS (TLS 1.2+).

### Do you provide a way for users to request data deletion?

**Yes** - Users can request deletion via in-app settings. A 30-day grace period applies before permanent deletion.

---

## 2. Data Types Collected

| Data Type | Category | Collected | Optional | Purpose |
|---|---|---|---|---|
| Email address | Personal info | Yes | No (required) | Account management, App functionality |
| Name | Personal info | Yes | Yes (optional) | App functionality (profile display) |
| Phone number | Personal info | Yes | Yes (optional) | Account management (2FA, recovery) |
| Photos | Photos and videos | Yes | Yes (user-initiated) | App functionality (skin analysis, portfolio) |
| AI-generated content | App activity | Yes | Yes (user-initiated) | App functionality (analysis results, generated images) |
| App interactions | App activity | Yes | No (automatic) | Analytics (feature usage, screen views) |
| Crash logs | App info and performance | Yes | No (automatic) | Analytics (stability improvement) |
| Push notification tokens | Device or other IDs | Yes | Yes (opt-in) | App functionality (notifications) |
| Instagram username | Online identifiers | Yes | Yes (opt-in) | App functionality (profile integration) |
| Instagram media | Photos and videos | Yes | Yes (opt-in) | App functionality (portfolio import) |

---

## 3. Data Sharing

### Data shared with third parties

| Third Party | Data Shared | Purpose | Notes |
|---|---|---|---|
| **Meta (Instagram)** | Instagram OAuth token, API requests | App functionality (IG feed import) | Server-side Graph API only. Data flows to Meta as part of their platform. |
| **Supabase** | Email, name, phone (encrypted), profile data, media references | App functionality (database, auth, storage) | Acts as data processor. Data stored in Supabase-managed infrastructure. |
| **HuggingFace** | Anonymized image features | App functionality (AI skin analysis processing) | **No PII is sent.** Images are preprocessed to extract features only. No usernames, emails, or identifiers are transmitted. |

### Data NOT shared

| Category | Details |
|---|---|
| **Advertising** | No data is shared with any third party for advertising purposes. |
| **Data brokers** | No data is sold or shared with data brokers. |
| **Cross-app tracking** | No cross-app or cross-site tracking is performed. |

---

## 4. Data Security

### Encryption

| Layer | Method | Details |
|---|---|---|
| **In transit** | HTTPS (TLS 1.2+) | All API calls, file uploads, and webhook callbacks |
| **At rest** | AES-256 GCM | Database encryption via Supabase (PostgreSQL). File storage encryption via Supabase Storage. |
| **Sensitive fields** | Additional encryption | Phone numbers are encrypted at the application level before storage. |

### Authentication

- Supabase Auth with JWT tokens
- Instagram OAuth 2.0 with server-side token exchange
- Tokens stored server-side only (never in client local storage)

---

## 5. Data Deletion

### User-Initiated Deletion

Users can request account and data deletion through:

1. **In-app**: Settings > Account > Delete Account
2. **Email**: Support email with identity verification
3. **Meta callback**: `POST /v1/meta/data-deletion` (for Instagram-linked data)

### Deletion Timeline

| Action | Timeline |
|---|---|
| Deletion request received | Immediate confirmation to user |
| Account deactivated | Immediate (login disabled) |
| Grace period (user can cancel) | 30 days |
| Permanent data deletion | After 30-day grace period |
| Backup purge | Within 14 days after permanent deletion |

### What gets deleted

- User profile (email, name, phone)
- All uploaded photos and AI analysis results
- Instagram-linked data (username, media references, tokens)
- Push notification tokens
- App interaction history

---

## 6. Data Retention Policy

| Data Category | Retention Period | Justification |
|---|---|---|
| **Server logs** (access logs, error logs) | 90 days | Debugging, security incident investigation |
| **Account data** (profile, preferences) | Duration of account + 30 days after deletion request | Core app functionality + grace period |
| **Payment records** | 5 years | Financial regulatory compliance (Korean tax law, Electronic Commerce Act) |
| **AI analysis results** | Duration of account | User-requested feature data |
| **Crash/analytics logs** | 90 days | App stability monitoring |
| **Instagram OAuth tokens** | Until user disconnects or token expires | Required for active Instagram integration |
| **Deleted account audit trail** | 1 year | Compliance verification (proof of deletion) |

---

## 7. Google Play Data Safety Form Answers Summary

| Question | Answer |
|---|---|
| Does your app collect any user data? | Yes |
| Is all collected data encrypted in transit? | Yes |
| Do you provide a way for users to request data deletion? | Yes |
| Is your app a game? | No |
| Does your app share user data with third parties? | Yes (Meta, Supabase, HuggingFace - functional only) |
| Does your app use data for advertising or marketing? | No |
| Does your app use data for account management? | Yes |
| Does your app use data for app functionality? | Yes |
| Does your app use data for analytics? | Yes (anonymized) |
| Does your app use data for fraud prevention/security? | Yes (login logs) |

---

## References

- [Google Play Data Safety Form](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Google Play User Data Policy](https://support.google.com/googleplay/android-developer/answer/10144311)
