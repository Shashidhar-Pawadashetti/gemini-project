# spec.md — Agent-Ready Product Requirements Document
## Project: Hybrid Social Media Platform (Instagram Feed × Twitter Interactions)
### Version: 1.0 | Phase: MVP | Stack: Next.js 14 (App Router) + Supabase (PostgreSQL) + Tailwind CSS

---

> **AGENT DIRECTIVE:** This document is the absolute source of truth for all code generation. You are forbidden from hallucinating APIs, inventing database tables, or deviating from the technology stack declared below. Every feature must be implemented in strict accordance with the acceptance criteria, state enumerations, and API contracts defined herein. If a requirement is ambiguous, invoke the `ask_user` tool — do not invent a resolution.

---

## 1. HIGH-LEVEL OBJECTIVES & SUCCESS CRITERIA

### 1.1 Platform Identity
This platform is a hybrid social network combining:
- **Instagram-style** visual content publishing (photo/video grid, story-like posts, media-first UX)
- **Twitter-style** real-time interactions (text posts, replies, retweets/reposts, follower graph, trending topics)

Target users are aged 18+ (enforced via age verification gateway). The platform supports asymmetric social relationships (follow without requiring follow-back).

### 1.2 Quantified Success Metrics (Non-Functional Requirements)
| Metric | Threshold | Enforcement Layer |
|--------|-----------|-------------------|
| Feed load latency (P95) | < 200ms | Composite DB index + cursor pagination |
| Image upload completion | < 5s for files ≤ 10MB | Chunked upload + signed URL pipeline |
| Real-time message delivery | < 500ms end-to-end | Supabase Realtime WebSocket |
| Authentication token refresh | < 100ms | httpOnly cookie + short-lived JWT |
| Search result latency (P95) | < 300ms | GIN full-text index on `tsvector` |
| Age verification decision | < 3s | AI estimation API timeout = 2.5s |
| API error rate | < 0.1% | Monitored via Supabase logs |
| Accessibility | WCAG 2.1 AA | Automated scanning enforced |

---

## 2. TECHNOLOGY STACK (IMMUTABLE — DO NOT DEVIATE)

```
Frontend:       Next.js 14 (App Router, React Server Components)
Styling:        Tailwind CSS v3 + shadcn/ui component library
State Mgmt:     Zustand (client state) + TanStack Query v5 (server state / caching)
Auth:           Supabase Auth (JWT + httpOnly refresh cookies) — NO localStorage token storage
Database:       Supabase PostgreSQL (with Row-Level Security enabled on ALL tables)
ORM:            Supabase JS client v2 (NO raw SQL from application layer except migrations)
File Storage:   Supabase Storage (signed URLs — backend NEVER handles binary image data directly)
Real-time:      Supabase Realtime (WebSocket subscriptions)
Type Safety:    TypeScript strict mode (NO `any` types permitted)
Testing:        Vitest (unit) + Playwright (E2E)
Linting:        ESLint + Prettier (enforced pre-commit via Husky)
Deployment:     Vercel (frontend) + Supabase cloud (backend)
```

**Forbidden patterns:**
- `localStorage` or `sessionStorage` for auth tokens
- Raw `fetch()` calls — use Supabase client or TanStack Query
- `any` TypeScript type — use `unknown` + type guard
- Class-based React components
- Direct binary file handling in API routes

---

## 3. FEATURE SPECIFICATIONS

---

### FEATURE 1: User Registration & Age Verification

#### 3.1.1 User Flow
1. User lands on `/register`
2. Enters: email, password, username, date of birth
3. System performs real-time username availability check (debounced 400ms)
4. On submit → age is computed server-side from `date_of_birth`
5. If age ≥ 18 → proceed to profile setup
6. If age < 18 OR confidence < 90% → trigger documentary ID fallback flow
7. On verified → create user record in `profiles` table → redirect to `/onboarding`

#### 3.1.2 State Enumerations
```typescript
type RegistrationState =
  | 'idle'
  | 'validating_username'       // debounced availability check in flight
  | 'username_taken'            // username already exists
  | 'username_available'        // username is free
  | 'submitting'                // form POST in flight
  | 'age_verifying'             // AI age estimation running
  | 'age_verified'              // user confirmed ≥ 18
  | 'age_rejected'              // user confirmed < 18 — block registration
  | 'age_uncertain'             // confidence < 90% — trigger ID fallback
  | 'id_verification_pending'   // awaiting documentary ID upload
  | 'id_verification_approved'  // ID confirmed ≥ 18
  | 'id_verification_rejected'  // ID confirms < 18
  | 'error_network'             // network failure during submission
  | 'error_email_taken'         // email already registered
  | 'success'                   // account created, redirect pending
```

#### 3.1.3 Acceptance Criteria
| ID | Input | Expected Output |
|----|-------|-----------------|
| REG-01 | Valid email + strong password + unique username + DOB ≥ 18yrs | Account created, redirect to `/onboarding` |
| REG-02 | Username already in `profiles` table | State → `username_taken`, inline error shown, form NOT submitted |
| REG-03 | Password < 8 characters | Client-side validation error before submission, form blocked |
| REG-04 | DOB yielding age < 18 | State → `age_rejected`, hard block with message, no account created |
| REG-05 | AI confidence score < 90% | State → `age_uncertain`, ID fallback flow triggered |
| REG-06 | Duplicate email | HTTP 409 → State → `error_email_taken`, inline error shown |
| REG-07 | Network failure on submit | HTTP 5xx → State → `error_network`, retry button shown |

#### 3.1.4 Age Verification — FTC 2026 Safe Harbor Compliance
```
AGENT CONSTRAINT: Biometric data (facial scan payloads) MUST follow these rules:
1. Route ONLY to designated age estimation API endpoint — NEVER to profile photo storage or S3
2. ZERO persistence — biometric data must NEVER touch PostgreSQL or Supabase Storage
3. Memory-only architecture — execute deterministic memory wipe immediately after boolean result
4. All transit secured via HTTPS (mTLS where API supports it)
5. Third-party estimation vendors MUST be whitelisted in Content Security Policy (CSP)
6. If confidence < 90% → automatically trigger documentary ID fallback
```

#### 3.1.5 Error Code Mapping
| HTTP Code | Trigger | UI Behavior |
|-----------|---------|-------------|
| 409 | Email already registered | Inline error: "An account with this email already exists" |
| 422 | Invalid field format | Field-level validation message |
| 429 | Rate limit hit | Visual backoff timer displayed (countdown in seconds) |
| 500 | Server error | Toast: "Something went wrong. Please try again." + retry button |
| 503 | Age verification API down | Fallback to documentary ID flow automatically |

---

### FEATURE 2: Onboarding Flow (Post-Registration)

#### 3.2.1 User Flow
Route: `/onboarding` (protected — requires authenticated session)

Steps (wizard, each step is a distinct route segment):
1. `/onboarding/avatar` — Profile photo upload with progress tracking
2. `/onboarding/bio` — Display name, bio (max 160 chars), location (optional)
3. `/onboarding/interests` — Mandatory selection of ≥ 3 interest tags (feeds recommendation algorithm)
4. `/onboarding/follow-suggestions` — AI-suggested accounts based on selected interests
5. Complete → redirect to `/home`

#### 3.2.2 State Enumerations
```typescript
type AvatarUploadState =
  | 'idle'
  | 'selecting'           // file picker open
  | 'validating'          // client-side file type/size check
  | 'error_file_type'     // non-image file selected
  | 'error_file_size'     // file > 10MB
  | 'uploading'           // chunked upload in progress (0–100%)
  | 'processing'          // server-side compression running
  | 'success'             // avatar URL saved to profile
  | 'error_upload'        // upload failed — retry available

type InterestSelectionState =
  | 'idle'
  | 'loading_tags'        // fetching interest taxonomy from DB
  | 'selecting'           // user choosing tags
  | 'error_min_not_met'   // user clicked Next with < 3 selected
  | 'saving'              // saving to user_interests table
  | 'success'
```

#### 3.2.3 Acceptance Criteria
| ID | Input | Expected Output |
|----|-------|-----------------|
| ONB-01 | User uploads valid JPEG/PNG/WebP ≤ 10MB | Progress bar 0→100%, compressed image saved to Supabase Storage, URL written to `profiles.avatar_url` |
| ONB-02 | User uploads file > 10MB | State → `error_file_size`, upload blocked, error shown |
| ONB-03 | User uploads non-image file | State → `error_file_type`, upload blocked |
| ONB-04 | User selects < 3 interests and clicks Next | State → `error_min_not_met`, inline error, navigation blocked |
| ONB-05 | User selects ≥ 3 interests | Saved to `user_interests` table, follow suggestions hydrated |
| ONB-06 | Upload fails mid-way | State → `error_upload`, retry button shown, partial upload cleaned from Storage |

#### 3.2.4 File Upload API Contract
```
POST /api/upload/avatar
Headers: Authorization: Bearer <access_token>
Body: FormData { file: File }

Success Response (200):
{
  "avatar_url": "https://<supabase-ref>.supabase.co/storage/v1/object/public/avatars/<user_id>/<filename>",
  "width": 400,
  "height": 400
}

Error Responses:
  400: { "error": "FILE_TOO_LARGE" | "INVALID_FILE_TYPE" }
  401: { "error": "UNAUTHORIZED" }
  500: { "error": "UPLOAD_FAILED" }
```

---

### FEATURE 3: Posts Feed (Text + Media)

#### 3.3.1 User Flow
- Authenticated user lands on `/home`
- Feed displays posts from followed accounts + algorithmic suggestions (for cold-start users)
- Feed uses **cursor-based pagination** (NOT offset-based) — cursor = `created_at` timestamp of last post
- Infinite scroll triggers next page fetch when user is 300px from bottom
- Each post card shows: avatar, username, timestamp, content text, media grid, like/comment/repost/bookmark counts
- Clicking post → `/post/[id]` (full detail view with thread)

#### 3.3.2 Post Creation
Route: `/compose` or modal overlay triggered from any page

```typescript
type PostCreationState =
  | 'idle'
  | 'composing'           // user typing
  | 'uploading_media'     // media files being uploaded
  | 'media_upload_error'  // one or more files failed
  | 'submitting'          // POST in flight
  | 'success'             // post created, feed updated optimistically
  | 'error_network'       // submission failed
  | 'error_content_empty' // user submitted with no text AND no media
```

#### 3.3.3 Post Visibility Tiers
```typescript
type PostVisibility = 'public' | 'followers' | 'private'
```
- `public`: visible to all authenticated users and unauthenticated visitors
- `followers`: visible only to approved followers (RLS enforced at DB layer)
- `private`: visible only to the author

#### 3.3.4 Feed Acceptance Criteria
| ID | Input | Expected Output |
|----|-------|-----------------|
| FEED-01 | Authenticated user with ≥ 1 followed account | Feed shows posts from followed accounts sorted reverse-chronologically |
| FEED-02 | Authenticated user following 0 accounts | Feed shows algorithmic suggestions based on interests from onboarding |
| FEED-03 | User scrolls to 300px from bottom | Next page of 20 posts fetched automatically (no duplicate posts via cursor) |
| FEED-04 | New post published by followed user | Appears in feed within 2s without page refresh (Supabase Realtime) |
| FEED-05 | Post with `visibility = 'followers'` | Hidden from non-followers even if direct URL accessed (RLS) |
| FEED-06 | Network failure during pagination | Error state shown inline, retry button available |

#### 3.3.5 Feed API Contract
```
GET /api/feed?cursor=<ISO_timestamp>&limit=20
Headers: Authorization: Bearer <access_token>

Success Response (200):
{
  "posts": [
    {
      "id": "uuid",
      "author": {
        "id": "uuid",
        "username": "string",
        "avatar_url": "string",
        "is_verified": boolean
      },
      "content": "string",
      "media_urls": ["string"],
      "visibility": "public" | "followers" | "private",
      "likes_count": number,
      "comments_count": number,
      "reposts_count": number,
      "is_liked_by_me": boolean,
      "is_reposted_by_me": boolean,
      "created_at": "ISO8601 string"
    }
  ],
  "next_cursor": "ISO8601 string | null"
}
```

---

### FEATURE 4: Follow / Unfollow System

#### 3.4.1 User Flow
- User visits `/profile/[username]`
- If not following → "Follow" button
  - Public account → immediate follow (`relationship_state = 'active'`)
  - Private account → "Request" button → `relationship_state = 'pending'`
- If following → "Following" button → click to unfollow
- If request pending → "Requested" button → click to cancel request
- Block action → severs ALL existing follow relationships bidirectionally, removes from each other's follower lists

#### 3.4.2 State Enumerations
```typescript
type FollowButtonState =
  | 'not_following'
  | 'following'
  | 'request_pending'
  | 'request_sent'        // transitional during submission
  | 'loading'             // any action in flight
  | 'error'

type BlockState =
  | 'not_blocked'
  | 'blocking'            // action in flight
  | 'blocked'             // I blocked this user
  | 'blocked_by'          // this user blocked me — profile hidden
```

#### 3.4.3 Acceptance Criteria
| ID | Input | Expected Output |
|----|-------|-----------------|
| FOL-01 | Follow public account | Immediate `active` relationship, follower count +1 on both profiles |
| FOL-02 | Follow private account | `pending` relationship created, notification sent to target, "Requested" button shown |
| FOL-03 | Private account approves request | State → `active`, follower/following counts updated |
| FOL-04 | Private account rejects request | Relationship row deleted, "Follow" button restored on requester's view |
| FOL-05 | Unfollow | Relationship row deleted, counts updated, posts no longer appear in feed |
| FOL-06 | Block user | Both follow relationships deleted, posts hidden, profile inaccessible to blocked user |
| FOL-07 | Follow own profile | Button not shown — hidden via UI check + server-side guard |
| FOL-08 | Already following — attempt duplicate follow | HTTP 409 returned, no duplicate row created (composite PK constraint) |

#### 3.4.4 API Contracts
```
POST /api/follow
Body: { "target_user_id": "uuid" }
Response 200: { "state": "active" | "pending" }
Response 409: { "error": "ALREADY_FOLLOWING" }

DELETE /api/follow
Body: { "target_user_id": "uuid" }
Response 200: { "success": true }

POST /api/block
Body: { "target_user_id": "uuid" }
Response 200: { "success": true }
// Side effect: cascading delete of all follow relationships between both users
```

---

### FEATURE 5: Like, Comment, Share (Interactions)

#### 3.5.1 Like
- Toggle-based (like → unlike)
- Optimistic UI update: count increments immediately, reverts on failure
- Stored as a row in `post_likes` table with `(user_id, post_id)` composite PK
- Triggers notification to post author (unless liker = author)

#### 3.5.2 Comment / Reply
- Threaded replies supported via `parent_comment_id` self-reference
- Comment box shown below post in detail view (`/post/[id]`)
- Max 500 characters per comment

```typescript
type CommentState =
  | 'idle'
  | 'composing'
  | 'submitting'
  | 'success'
  | 'error_too_long'       // > 500 chars
  | 'error_empty'          // submitted with no text
  | 'error_network'
```

#### 3.5.3 Repost / Quote
- Simple repost: creates a new `post` row with `repost_of_id` FK to original
- Quote post: creates a new post with original embedded as a card + author's new text
- Repost count visible on original post

#### 3.5.4 Acceptance Criteria
| ID | Input | Expected Output |
|----|-------|-----------------|
| INT-01 | Like a post | Optimistic +1, row inserted into `post_likes`, notification queued |
| INT-02 | Unlike a post | Optimistic -1, row deleted from `post_likes` |
| INT-03 | Like fails (network) | Count reverts to pre-action value, toast error shown |
| INT-04 | Like own post | Like button disabled (server-side guard + RLS) |
| INT-05 | Comment with > 500 chars | State → `error_too_long`, submit blocked |
| INT-06 | Reply to comment | `parent_comment_id` set, threaded indent shown in UI |
| INT-07 | Repost | New post row created with `repost_of_id` set, original post count +1 |

---

### FEATURE 6: Direct Messaging (Real-Time Chat)

#### 3.6.1 User Flow
- User navigates to `/messages`
- Sees list of conversations sorted by most recent message
- Clicking conversation → `/messages/[conversation_id]`
- Messages rendered in reverse-chronological scroll (latest at bottom)
- Real-time delivery via Supabase Realtime WebSocket subscription
- Message states: `sent` → `delivered` → `read`

#### 3.6.2 State Enumerations
```typescript
type MessageState = 'sent' | 'delivered' | 'read' | 'failed' | 'offline_queued'

type ConversationLoadState =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'error_unauthorized'    // user tried to access conversation they're not in
  | 'error_network'

type MessageSendState =
  | 'composing'
  | 'sending'
  | 'sent'
  | 'error_failed'
  | 'offline_queued'        // sent while offline, will retry on reconnect
```

#### 3.6.3 Acceptance Criteria
| ID | Input | Expected Output |
|----|-------|-----------------|
| MSG-01 | User sends message | Optimistic display immediately, state → `sent`, then `delivered` on DB write |
| MSG-02 | Recipient is online | Message appears in < 500ms via Realtime subscription |
| MSG-03 | Recipient is offline | Message stored in DB with `delivered: false`, delivered on next connection |
| MSG-04 | User tries to access conversation they're not in | HTTP 403, redirect to `/messages` |
| MSG-05 | User sends message while offline | State → `offline_queued`, auto-retry on reconnect |
| MSG-06 | Recipient reads message | State for sender updates to `read` via Realtime |
| MSG-07 | Message > 2000 characters | Submit blocked, character counter turns red |

#### 3.6.4 Security Constraint (CRITICAL)
```
RLS POLICY REQUIRED:
Users can ONLY SELECT/INSERT messages where:
  auth.uid() = sender_id OR auth.uid() = recipient_id

This policy is enforced at the database layer — NOT just in application code.
An unauthenticated API call to fetch messages MUST return 0 rows, not an error.
```

#### 3.6.5 API Contract
```
GET /api/messages/[conversation_id]?cursor=<uuid>&limit=30
Response 200: {
  "messages": [
    {
      "id": "uuid",
      "sender_id": "uuid",
      "content": "string",
      "state": "sent" | "delivered" | "read",
      "created_at": "ISO8601"
    }
  ],
  "next_cursor": "uuid | null"
}

POST /api/messages/[conversation_id]
Body: { "content": "string" }
Response 201: { "id": "uuid", "state": "sent", "created_at": "ISO8601" }
Response 403: { "error": "NOT_PARTICIPANT" }
```

---

### FEATURE 7: Notifications

#### 3.7.1 Notification Types
```typescript
type NotificationActionType =
  | 'like'              // someone liked your post
  | 'comment'           // someone commented on your post
  | 'reply'             // someone replied to your comment
  | 'follow'            // someone followed you
  | 'follow_request'    // someone requested to follow you (private account)
  | 'follow_approved'   // your follow request was approved
  | 'repost'            // someone reposted your post
  | 'mention'           // someone mentioned @you in a post or comment
  | 'system'            // platform-level alert
```

#### 3.7.2 State Enumerations
```typescript
type NotificationLoadState =
  | 'idle'
  | 'loading'
  | 'loaded_empty'       // no notifications
  | 'loaded'
  | 'error_network'

type NotificationItemState = 'unread' | 'read'
```

#### 3.7.3 Acceptance Criteria
| ID | Input | Expected Output |
|----|-------|-----------------|
| NOT-01 | User receives a like | Bell icon badge count +1, notification row created in `notifications` table |
| NOT-02 | User opens notifications | All `unread` notifications marked `read`, badge cleared |
| NOT-03 | Liker = post author | Notification NOT created (self-notification guard in DB trigger) |
| NOT-04 | Blocked user interaction | Notification NOT created (RLS blocks delivery) |
| NOT-05 | System notification | Shown with distinct visual treatment, no actor avatar |
| NOT-06 | Real-time delivery | New notification appears in < 1s via Supabase Realtime while user is on page |

#### 3.7.4 Payload Denormalization (Performance)
```
AGENT CONSTRAINT: The notifications.payload JSONB column MUST contain a denormalized
snapshot of display data at the time the event occurs. Example:
{
  "actor_username": "johndoe",
  "actor_avatar_url": "https://...",
  "post_preview": "First 80 chars of post content..."
}
This prevents join queries when rendering the notification feed.
Do NOT perform multi-table joins to render notifications — use payload only.
```

---

### FEATURE 8: Search & Discovery

#### 3.8.1 Search Scope
- Search users by `username` or `display_name`
- Search posts by full-text content (GIN index on `tsvector`)
- Search hashtags (trending + recent)
- Results page: `/search?q=<query>&type=users|posts|tags`

#### 3.8.2 State Enumerations
```typescript
type SearchState =
  | 'idle'
  | 'typing'              // debounced — no fetch yet (< 300ms since last keystroke)
  | 'loading'             // fetch in flight
  | 'loaded_empty'        // 0 results
  | 'loaded'              // results shown
  | 'error_network'
```

#### 3.8.3 Acceptance Criteria
| ID | Input | Expected Output |
|----|-------|-----------------|
| SRC-01 | User types query (debounced 300ms) | Fetch fires after 300ms idle, results shown |
| SRC-02 | Query matches no results | State → `loaded_empty`, "No results found" shown |
| SRC-03 | Private account appears in user search | Username/avatar shown but posts NOT shown unless following |
| SRC-04 | Blocked user searched | User does not appear in results |
| SRC-05 | Query < 2 characters | No fetch fired, prompt "Type at least 2 characters" shown |
| SRC-06 | Full-text post search | GIN index used — NEVER a `LIKE '%term%'` query |

#### 3.8.4 API Contract
```
GET /api/search?q=<string>&type=users|posts|tags&limit=20
Headers: Authorization: Bearer <access_token>

Response 200:
{
  "users": [ { "id", "username", "avatar_url", "is_verified", "followers_count" } ],
  "posts": [ { "id", "content_preview", "author", "likes_count", "created_at" } ],
  "tags": [ { "tag", "post_count" } ]
}
```

---

## 4. AUTHENTICATION & SESSION MANAGEMENT

### 4.1 Auth Flow
```
Registration → Supabase Auth email confirmation → JWT issued
Login → POST /auth/v1/token → access_token (15min) + refresh_token (30 days, httpOnly cookie)
Token refresh → automatic via Supabase client on 401 response
Logout → DELETE /auth/v1/logout → cookie cleared, tokens revoked
```

### 4.2 Security Constraints
```
AGENT CONSTRAINTS:
- NEVER store access_token in localStorage or sessionStorage
- Refresh token MUST be in httpOnly, SameSite=Strict cookie ONLY
- All authenticated API routes MUST call supabase.auth.getUser() server-side — NOT client-side session
- Role-based access: 'authenticated' role for logged-in users, 'anon' for public
- Password minimum: 8 characters, 1 uppercase, 1 number
- Email verification required before first login
```

### 4.3 Protected Routes
All routes except `/`, `/login`, `/register`, `/post/[id]` (public posts only) require valid session.
Unauthenticated access to protected routes → redirect to `/login?redirect=<original_path>`

---

## 5. DATABASE SCHEMA REFERENCE

> Full schema DDL is defined in `schema.md`. Below are the table names the agent must use — DO NOT invent new table names.

```
auth.users          — Managed by Supabase Auth (DO NOT modify directly)
profiles            — Extended user profile data
posts               — All user-generated content (text + media)
post_likes          — Like events (composite PK: user_id + post_id)
comments            — Post comments + threaded replies
reposts             — Repost events
followers           — Follow graph junction table
notifications       — Notification events (Actor-Action-Target model)
conversations       — DM conversation metadata
messages            — Individual DM messages
user_interests      — User → interest tag mappings
interest_tags       — Interest taxonomy (seeded)
```

**RLS is ENABLED on ALL tables listed above.**

---

## 6. GLOBAL ERROR HANDLING CONTRACT

All API routes must return errors in this exact shape:
```typescript
type APIError = {
  error: string;          // machine-readable error code (SCREAMING_SNAKE_CASE)
  message: string;        // human-readable description
  status: number;         // HTTP status code
}
```

Standard error code mappings:
| HTTP | Error Code | When to Use |
|------|-----------|-------------|
| 400 | `BAD_REQUEST` | Invalid input format |
| 401 | `UNAUTHORIZED` | Missing or expired token |
| 403 | `FORBIDDEN` | Valid token, insufficient permission |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate resource (follow, email) |
| 422 | `VALIDATION_ERROR` | Business logic validation failure |
| 429 | `RATE_LIMITED` | Too many requests — include `retry_after` seconds |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 503 | `SERVICE_UNAVAILABLE` | External service (age verification, storage) down |

---

## 7. COMPONENT DIRECTORY STRUCTURE

```
src/
├── app/                         # Next.js App Router pages
│   ├── (auth)/                  # Auth group: login, register
│   ├── (main)/                  # Main app group: home, profile, messages, search
│   ├── onboarding/              # Onboarding wizard
│   └── api/                     # API route handlers
├── components/
│   ├── ui/                      # shadcn/ui base components (DO NOT MODIFY)
│   ├── feed/                    # Feed-specific components
│   ├── post/                    # Post card, composer, detail view
│   ├── profile/                 # Profile header, grid, follow button
│   ├── messages/                # Chat UI components
│   ├── notifications/           # Notification list + item
│   └── search/                  # Search bar, results
├── lib/
│   ├── supabase/                # Supabase client (server + client instances)
│   ├── hooks/                   # Custom React hooks (useFollowState, useFeed, etc.)
│   ├── stores/                  # Zustand stores
│   └── utils/                   # Pure utility functions
├── types/                       # Global TypeScript type definitions
└── middleware.ts                 # Auth session middleware (route protection)
```

---

## 8. BEHAVIORAL RULES FOR AI AGENTS

```
ALWAYS:
- Check RLS policies exist before assuming data access patterns
- Use cursor-based pagination — NEVER OFFSET
- Write TypeScript — NEVER plain JavaScript
- Place new hooks in src/lib/hooks/
- Use Supabase server client in Server Components and API routes
- Use Supabase browser client in Client Components only

ASK FIRST:
- Before adding any new npm package not listed in the tech stack
- Before creating a new database table not listed in section 5
- Before changing any RLS policy
- Before modifying authentication flow

NEVER:
- Store tokens in localStorage
- Write `SELECT *` queries — always specify columns
- Skip error handling in async functions
- Use OFFSET for pagination
- Handle binary file data in API routes — use signed URLs
- Write `any` TypeScript types
- Modify files in src/components/ui/ (shadcn base components)
- Touch auth.users table directly
```

---

*Document Version: 1.0 | Generated for Phase 1 completion | Next: schema.md (Phase 2)*