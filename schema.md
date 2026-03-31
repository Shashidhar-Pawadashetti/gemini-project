# schema.md — Database Architecture & Row-Level Security
## Project: Pulse — Hybrid Social Media Platform
## Stack: PostgreSQL 15 via Supabase | Version: 1.0

---

> **AGENT DIRECTIVE:** This document is the absolute database source of truth.
> - RLS is ENABLED on every table listed here — no exceptions.
> - Never write `SELECT *` — always name columns explicitly.
> - Never use OFFSET pagination — always use cursor-based (created_at or id).
> - Never add a table not listed here without explicit human approval.
> - All primary keys are UUIDv7 (time-sorted) — never serial integers.
> - All timestamps use `timestamptz` — never `timestamp` without timezone.

---

## 0. EXTENSIONS & GLOBAL SETUP

```sql
-- Required extensions (run once on project init)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- Trigram similarity for fuzzy search
CREATE EXTENSION IF NOT EXISTS "unaccent";       -- Accent-insensitive full-text search

-- Custom UUIDv7 function (time-sorted — reduces B-Tree fragmentation vs UUIDv4)
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid AS $$
  SELECT encode(
    set_bit(
      set_bit(
        overlay(uuid_send(gen_random_uuid()) PLACING
          substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
          FROM 1 FOR 6),
        52, 1),
      53, 1),
    'hex')::uuid;
$$ LANGUAGE sql VOLATILE;
```

---

## 1. PROFILES TABLE

### Rationale
Extends `auth.users` (managed by Supabase Auth). Never modify `auth.users` directly.
Uses `jsonb` metadata column for schema-less extensibility (pronoun declarations,
custom theme, verification badges) — avoids costly migrations for new profile fields.
Denormalized follower/following/posts counts prevent O(N) COUNT queries on page load.

```sql
CREATE TABLE profiles (
  id                uuid          PRIMARY KEY DEFAULT uuid_generate_v7(),
  username          text          NOT NULL,
  display_name      text          NOT NULL,
  bio               text,
  avatar_url        text,
  cover_url         text,
  location          text,
  website           text,
  date_of_birth     date          NOT NULL,   -- COPPA compliance + age-gated RLS
  is_private        boolean       NOT NULL DEFAULT false,
  is_verified       boolean       NOT NULL DEFAULT false,

  -- Denormalized counters (updated via triggers — never computed at query time)
  followers_count   integer       NOT NULL DEFAULT 0 CHECK (followers_count >= 0),
  following_count   integer       NOT NULL DEFAULT 0 CHECK (following_count >= 0),
  posts_count       integer       NOT NULL DEFAULT 0 CHECK (posts_count >= 0),

  -- Schema-less extensibility
  metadata          jsonb,

  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT profiles_username_length    CHECK (char_length(username) BETWEEN 3 AND 30),
  CONSTRAINT profiles_username_format    CHECK (username ~ '^[a-zA-Z0-9_]+$'),
  CONSTRAINT profiles_display_name_len   CHECK (char_length(display_name) <= 60),
  CONSTRAINT profiles_bio_length         CHECK (char_length(bio) <= 160),
  CONSTRAINT profiles_website_format     CHECK (website IS NULL OR website ~ '^https?://'),

  UNIQUE (username)
);

-- Foreign key to auth system
ALTER TABLE profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

### Indexes
```sql
-- Primary lookup: username → profile (login, mentions, @-tagging)
CREATE UNIQUE INDEX idx_profiles_username ON profiles (lower(username));

-- Algorithmic suggestion queries (verified + follower count)
CREATE INDEX idx_profiles_verified ON profiles (is_verified, followers_count DESC)
  WHERE is_verified = true;

-- Age-gated RLS policy support
CREATE INDEX idx_profiles_dob ON profiles (date_of_birth);

-- GIN index on jsonb metadata for selective key queries
CREATE INDEX idx_profiles_metadata ON profiles USING GIN (metadata jsonb_path_ops);
```

### RLS
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read public profiles
CREATE POLICY "profiles_select_public"
ON profiles FOR SELECT
USING (true);

-- Users can only update their own profile
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Profile is auto-created on registration (handled by Supabase trigger)
CREATE POLICY "profiles_insert_own"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Users can only delete their own account
CREATE POLICY "profiles_delete_own"
ON profiles FOR DELETE
TO authenticated
USING (auth.uid() = id);
```

---

## 2. POSTS TABLE

### Rationale
Self-referencing FKs support both threaded replies (`parent_post_id`) and
quote-reposts (`repost_of_id`). The `tsvector` column is pre-computed and
GIN-indexed for full-text search — eliminates `LIKE '%term%'` sequential scans.
Composite index on `(author_id, created_at DESC)` is mandatory for profile grid
queries: avoids full table scan when loading a user's posts.

```sql
CREATE TYPE post_visibility AS ENUM ('public', 'followers', 'private');

CREATE TABLE posts (
  id              uuid            PRIMARY KEY DEFAULT uuid_generate_v7(),
  author_id       uuid            NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content         text,
  media_urls      text[]          DEFAULT '{}',
  visibility      post_visibility NOT NULL DEFAULT 'public',

  -- Hierarchical content
  parent_post_id  uuid            REFERENCES posts(id) ON DELETE SET NULL,  -- reply
  repost_of_id    uuid            REFERENCES posts(id) ON DELETE SET NULL,  -- repost

  -- Denormalized counters (trigger-maintained)
  likes_count     integer         NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  comments_count  integer         NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  reposts_count   integer         NOT NULL DEFAULT 0 CHECK (reposts_count >= 0),
  views_count     integer         NOT NULL DEFAULT 0 CHECK (views_count >= 0),

  -- Full-text search pre-computation
  search_vector   tsvector,

  created_at      timestamptz     NOT NULL DEFAULT now(),
  updated_at      timestamptz     NOT NULL DEFAULT now(),

  -- A post must have content OR media — never both empty
  CONSTRAINT posts_not_empty CHECK (
    content IS NOT NULL AND char_length(content) > 0
    OR array_length(media_urls, 1) > 0
  ),
  CONSTRAINT posts_content_length CHECK (char_length(content) <= 500),
  CONSTRAINT posts_media_limit    CHECK (array_length(media_urls, 1) <= 4)
);
```

### Indexes
```sql
-- CRITICAL: Profile page grid — author's posts in reverse-chronological order
-- Reduces query to O(log N) instead of full table scan
CREATE INDEX idx_posts_author_created
  ON posts (author_id, created_at DESC);

-- Feed generation: filter by visibility + author
CREATE INDEX idx_posts_visibility_author
  ON posts (visibility, author_id, created_at DESC);

-- Threaded replies lookup
CREATE INDEX idx_posts_parent
  ON posts (parent_post_id, created_at ASC)
  WHERE parent_post_id IS NOT NULL;

-- Repost chain lookup
CREATE INDEX idx_posts_repost_of
  ON posts (repost_of_id)
  WHERE repost_of_id IS NOT NULL;

-- GIN index for full-text search (fastupdate=on reduces write overhead)
CREATE INDEX idx_posts_search
  ON posts USING GIN (search_vector)
  WITH (fastupdate = on);

-- Trigger to auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION posts_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'A');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_search_vector_trigger
  BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION posts_search_vector_update();
```

### RLS
```sql
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Public posts visible to everyone (including anon)
-- Followers-only posts visible to approved followers
-- Private posts visible to author only
-- Age-restricted posts filtered by viewer's DOB (COPPA/age-gating)
CREATE POLICY "posts_select_visibility"
ON posts FOR SELECT
USING (
  -- Author always sees own posts
  author_id = auth.uid()
  OR (
    -- Public posts: visible to all authenticated users
    visibility = 'public'
  )
  OR (
    -- Followers-only: must have active follow relationship
    visibility = 'followers'
    AND EXISTS (
      SELECT 1 FROM followers
      WHERE follower_id = auth.uid()
        AND followed_id = posts.author_id
        AND relationship_state = 'active'
    )
  )
);

-- Authors can insert their own posts
CREATE POLICY "posts_insert_own"
ON posts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

-- Authors can update their own posts (content + visibility only)
CREATE POLICY "posts_update_own"
ON posts FOR UPDATE
TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);

-- Authors can delete their own posts (cascades to likes, comments)
CREATE POLICY "posts_delete_own"
ON posts FOR DELETE
TO authenticated
USING (auth.uid() = author_id);
```

---

## 3. POST_LIKES TABLE

### Rationale
Composite primary key `(user_id, post_id)` enforces mathematical idempotency —
physically impossible to like a post twice. Triggers atomically update
`posts.likes_count` and fire notification events.

```sql
CREATE TABLE post_likes (
  user_id     uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id     uuid          NOT NULL REFERENCES posts(id)    ON DELETE CASCADE,
  created_at  timestamptz   NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, post_id)
);
```

### Indexes
```sql
-- "Who liked this post?" — post detail view
CREATE INDEX idx_post_likes_post_id ON post_likes (post_id, created_at DESC);

-- "Did I like this post?" — feed rendering (is_liked_by_me)
-- Covered by PK (user_id, post_id) — no additional index needed
```

### Triggers
```sql
-- Auto-increment/decrement posts.likes_count
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    -- Queue notification (skip if liker = author)
    IF NEW.user_id <> (SELECT author_id FROM posts WHERE id = NEW.post_id) THEN
      INSERT INTO notifications (recipient_id, actor_id, action_type, entity_type, entity_id, payload)
      SELECT
        p.author_id,
        NEW.user_id,
        'like',
        'post',
        NEW.post_id,
        jsonb_build_object(
          'actor_username', pr.username,
          'actor_avatar_url', pr.avatar_url,
          'post_preview', left(p.content, 80)
        )
      FROM posts p
      JOIN profiles pr ON pr.id = NEW.user_id
      WHERE p.id = NEW.post_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER post_likes_count_trigger
  AFTER INSERT OR DELETE ON post_likes
  FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();
```

### RLS
```sql
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_likes_select"
ON post_likes FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM posts WHERE id = post_likes.post_id AND visibility = 'public'
  )
);

CREATE POLICY "post_likes_insert"
ON post_likes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  -- Cannot like own post
  AND auth.uid() <> (SELECT author_id FROM posts WHERE id = post_id)
);

CREATE POLICY "post_likes_delete"
ON post_likes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
```

---

## 4. COMMENTS TABLE

### Rationale
Self-referencing `parent_comment_id` enables nested threading (depth ≥ 2).
Index on `(post_id, created_at ASC)` serves top-level comment loading.
Index on `(parent_comment_id, created_at ASC)` serves nested reply expansion.

```sql
CREATE TABLE comments (
  id                  uuid          PRIMARY KEY DEFAULT uuid_generate_v7(),
  post_id             uuid          NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id           uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_comment_id   uuid          REFERENCES comments(id) ON DELETE CASCADE,
  content             text          NOT NULL,
  likes_count         integer       NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  created_at          timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT comments_content_length CHECK (char_length(content) BETWEEN 1 AND 500)
);
```

### Indexes
```sql
-- Top-level comments for a post (chronological)
CREATE INDEX idx_comments_post_id
  ON comments (post_id, created_at ASC)
  WHERE parent_comment_id IS NULL;

-- Nested replies for a comment
CREATE INDEX idx_comments_parent
  ON comments (parent_comment_id, created_at ASC)
  WHERE parent_comment_id IS NOT NULL;

-- Trigger: auto-update posts.comments_count
CREATE OR REPLACE FUNCTION update_comments_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER comments_count_trigger
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_comments_count();
```

### RLS
```sql
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select"
ON comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM posts
    WHERE id = comments.post_id
    AND (
      visibility = 'public'
      OR author_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM followers
        WHERE follower_id = auth.uid()
          AND followed_id = posts.author_id
          AND relationship_state = 'active'
      )
    )
  )
);

CREATE POLICY "comments_insert"
ON comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "comments_delete_own"
ON comments FOR DELETE
TO authenticated
USING (auth.uid() = author_id);
```

---

## 5. FOLLOWERS TABLE (Social Graph)

### Rationale
Directed, asymmetric graph — User A following User B does NOT imply B follows A.
Composite PK `(follower_id, followed_id)` ensures idempotency.
`relationship_state` handles private account pending-approval flow.
Two separate indexes support BOTH directions of graph traversal efficiently.
Denormalized counter triggers prevent O(N) COUNT(*) on profile load.

```sql
CREATE TYPE follow_state AS ENUM ('active', 'pending', 'blocked');

CREATE TABLE followers (
  follower_id           uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  followed_id           uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  relationship_state    follow_state  NOT NULL DEFAULT 'active',
  created_at            timestamptz   NOT NULL DEFAULT now(),

  PRIMARY KEY (follower_id, followed_id),

  -- Cannot follow yourself
  CONSTRAINT followers_no_self_follow CHECK (follower_id <> followed_id)
);
```

### Indexes
```sql
-- "Who is User A following?" → feed generation
CREATE INDEX idx_followers_follower_id
  ON followers (follower_id, relationship_state);

-- "Who follows User B?" → profile follower count + fan-out
CREATE INDEX idx_followers_followed_id
  ON followers (followed_id, relationship_state);

-- Pending requests for a private account
CREATE INDEX idx_followers_pending
  ON followers (followed_id, created_at DESC)
  WHERE relationship_state = 'pending';
```

### Triggers
```sql
-- Atomically maintain followers_count and following_count on profiles
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.relationship_state = 'active' THEN
    UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.followed_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Pending → Active (request approved)
    IF OLD.relationship_state = 'pending' AND NEW.relationship_state = 'active' THEN
      UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.followed_id;
      UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    END IF;
    -- Active → Blocked or deleted (unfollow / block)
    IF OLD.relationship_state = 'active' AND NEW.relationship_state = 'blocked' THEN
      UPDATE profiles SET followers_count = followers_count - 1 WHERE id = OLD.followed_id;
      UPDATE profiles SET following_count = following_count - 1 WHERE id = OLD.follower_id;
    END IF;

  ELSIF TG_OP = 'DELETE' AND OLD.relationship_state = 'active' THEN
    UPDATE profiles SET followers_count = followers_count - 1 WHERE id = OLD.followed_id;
    UPDATE profiles SET following_count = following_count - 1 WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER followers_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON followers
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();
```

### RLS
```sql
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

-- Follower relationships are readable by both parties
CREATE POLICY "followers_select"
ON followers FOR SELECT
USING (
  follower_id = auth.uid()
  OR followed_id = auth.uid()
  OR relationship_state = 'active'   -- public graph traversal allowed
);

-- Only the follower can initiate a follow
CREATE POLICY "followers_insert"
ON followers FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = follower_id);

-- Follower can unfollow; followed can approve/reject requests
CREATE POLICY "followers_update"
ON followers FOR UPDATE
TO authenticated
USING (
  auth.uid() = follower_id   -- follower modifying own follow
  OR auth.uid() = followed_id -- followed approving/rejecting request
);

CREATE POLICY "followers_delete"
ON followers FOR DELETE
TO authenticated
USING (
  auth.uid() = follower_id   -- unfollow
  OR auth.uid() = followed_id -- remove follower
);
```

---

## 6. NOTIFICATIONS TABLE (Actor-Action-Target Paradigm)

### Rationale
Generalised Actor-Action-Target model accommodates all future notification types
without schema migrations. The `payload` JSONB column stores a denormalized snapshot
of display data (actor avatar, post preview) at event time — eliminates multi-table
joins when rendering the notification feed. Index on `(recipient_id, is_read, created_at)`
supports the unread badge count and chronological feed in a single scan.

```sql
CREATE TYPE notification_action AS ENUM (
  'like', 'comment', 'reply', 'follow', 'follow_request',
  'follow_approved', 'repost', 'mention', 'system'
);

CREATE TABLE notifications (
  id            uuid                  PRIMARY KEY DEFAULT uuid_generate_v7(),
  recipient_id  uuid                  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id      uuid                  REFERENCES profiles(id) ON DELETE SET NULL,
  action_type   notification_action   NOT NULL,
  entity_type   text                  NOT NULL,   -- 'post' | 'comment' | 'user' | 'system'
  entity_id     uuid,                             -- nullable for system alerts
  payload       jsonb,                            -- denormalized display snapshot
  is_read       boolean               NOT NULL DEFAULT false,
  created_at    timestamptz           NOT NULL DEFAULT now(),

  -- Self-notification guard: actor cannot = recipient (enforced at trigger + DB level)
  CONSTRAINT notifications_no_self CHECK (actor_id IS NULL OR actor_id <> recipient_id)
);
```

### Indexes
```sql
-- Primary: user's notification feed (unread first, then chronological)
CREATE INDEX idx_notifications_recipient
  ON notifications (recipient_id, is_read, created_at DESC);

-- Unread badge count query
CREATE INDEX idx_notifications_unread
  ON notifications (recipient_id)
  WHERE is_read = false;
```

### RLS
```sql
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own"
ON notifications FOR SELECT
TO authenticated
USING (recipient_id = auth.uid());

CREATE POLICY "notifications_update_own"
ON notifications FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

-- Notifications are created by server-side triggers only (SECURITY DEFINER)
-- No direct INSERT policy for authenticated role
```

---

## 7. CONVERSATIONS & MESSAGES TABLES

### Rationale
`conversations` is a metadata table only — it holds no message content.
`conversation_members` is the join table linking users to conversations (supports
group DMs in future without schema change). `messages` stores the actual content.
RLS on `messages` is the most critical security boundary in the entire schema —
users must ONLY see messages from conversations they are members of.

```sql
CREATE TABLE conversations (
  id                uuid          PRIMARY KEY DEFAULT uuid_generate_v7(),
  created_at        timestamptz   NOT NULL DEFAULT now(),
  last_message_at   timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE conversation_members (
  conversation_id   uuid          NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id           uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at         timestamptz   NOT NULL DEFAULT now(),

  PRIMARY KEY (conversation_id, user_id)
);

CREATE TYPE message_state AS ENUM ('sent', 'delivered', 'read', 'failed');

CREATE TABLE messages (
  id                uuid            PRIMARY KEY DEFAULT uuid_generate_v7(),
  conversation_id   uuid            NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id         uuid            NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content           text            NOT NULL,
  state             message_state   NOT NULL DEFAULT 'sent',
  created_at        timestamptz     NOT NULL DEFAULT now(),

  CONSTRAINT messages_content_length CHECK (char_length(content) BETWEEN 1 AND 2000)
);
```

### Indexes
```sql
-- Load messages for a conversation (cursor-based pagination)
CREATE INDEX idx_messages_conversation
  ON messages (conversation_id, created_at DESC);

-- User's conversation list sorted by most recent activity
CREATE INDEX idx_conversation_members_user
  ON conversation_members (user_id);

CREATE INDEX idx_conversations_last_message
  ON conversations (last_message_at DESC);

-- Trigger: update conversations.last_message_at on new message
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS trigger AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER messages_update_conversation_trigger
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();
```

### RLS — CRITICAL SECURITY BOUNDARY
```sql
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Conversations: visible only to members
CREATE POLICY "conversations_select_members"
ON conversations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = conversations.id
      AND user_id = auth.uid()
  )
);

-- Conversation members: visible to members of that conversation
CREATE POLICY "conversation_members_select"
ON conversation_members FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- CRITICAL: Messages only visible to conversation participants
-- Uses EXISTS with short-circuit evaluation for performance
CREATE POLICY "messages_select_participants"
ON messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
  )
);

-- Only conversation participants can send messages
CREATE POLICY "messages_insert_participants"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
  )
);
```

---

## 8. FEEDS TABLE (Hybrid Fan-Out Architecture)

### Rationale
Implements the PUSH side of the hybrid fan-out model defined in the spec.
Standard users (<10K followers) use Fan-out on Write — their posts are pre-inserted
into each follower's feed row at publish time via an async worker.
Celebrity accounts (≥10K followers) use Fan-out on Read — excluded from push queue,
merged dynamically at read time.
Feed queries become O(1) index lookups instead of O(N) graph traversals.

```sql
CREATE TABLE feeds (
  owner_id    uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id     uuid          NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  -- Denormalized from posts.created_at to avoid JOIN on every feed fetch
  created_at  timestamptz   NOT NULL,

  PRIMARY KEY (owner_id, post_id)
);
```

### Indexes
```sql
-- THE most performance-critical index in the schema
-- Feed fetch: O(1) lookup for user's pre-computed feed, reverse-chronological
CREATE INDEX idx_feeds_owner_created
  ON feeds (owner_id, created_at DESC);
```

### RLS
```sql
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feeds_select_own"
ON feeds FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- Feed rows are inserted by server-side workers (SECURITY DEFINER functions)
-- No direct INSERT policy for authenticated role
```

---

## 9. INTEREST TAGS & USER INTERESTS TABLES

### Rationale
Normalised taxonomy table (`interest_tags`) seeds the onboarding flow and powers
the cold-start recommendation algorithm. `user_interests` is the many-to-many
junction storing each user's selections from onboarding Step 3.

```sql
CREATE TABLE interest_tags (
  id        uuid    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tag       text    NOT NULL,
  category  text    NOT NULL,

  UNIQUE (tag)
);

-- Seed data (run once)
INSERT INTO interest_tags (tag, category) VALUES
  ('Design',       'Creative'),
  ('Technology',   'Tech'),
  ('Photography',  'Creative'),
  ('Music',        'Entertainment'),
  ('Travel',       'Lifestyle'),
  ('Food',         'Lifestyle'),
  ('Sports',       'Lifestyle'),
  ('Gaming',       'Entertainment'),
  ('Film',         'Entertainment'),
  ('Books',        'Education'),
  ('Science',      'Education'),
  ('Fashion',      'Creative'),
  ('Art',          'Creative'),
  ('Business',     'Professional'),
  ('Wellness',     'Lifestyle');

CREATE TABLE user_interests (
  user_id   uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tag_id    uuid    NOT NULL REFERENCES interest_tags(id) ON DELETE CASCADE,

  PRIMARY KEY (user_id, tag_id)
);
```

### RLS
```sql
ALTER TABLE interest_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interest_tags_select_all"
ON interest_tags FOR SELECT
USING (true);

CREATE POLICY "user_interests_select_own"
ON user_interests FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "user_interests_insert_own"
ON user_interests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_interests_delete_own"
ON user_interests FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
```

---

## 10. COMPOSITE QUERY EXAMPLES

### 10.1 Home Feed Query (Hybrid Fan-out)
```sql
-- Step 1: Pull pre-computed push feed (standard followed users)
SELECT
  p.id, p.content, p.media_urls, p.visibility,
  p.likes_count, p.comments_count, p.reposts_count,
  p.created_at,
  pr.username, pr.display_name, pr.avatar_url, pr.is_verified,
  EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = auth.uid()) AS is_liked_by_me
FROM feeds f
JOIN posts p   ON p.id = f.post_id
JOIN profiles pr ON pr.id = p.author_id
WHERE f.owner_id = auth.uid()
  AND f.created_at < :cursor          -- cursor-based pagination
ORDER BY f.created_at DESC
LIMIT 20;

-- Step 2 (merged in-application): Pull celebrity posts dynamically
-- (accounts with followers_count >= 10000 that the current user follows)
SELECT p.*, pr.*
FROM posts p
JOIN profiles pr ON pr.id = p.author_id
JOIN followers f ON f.followed_id = p.author_id
WHERE f.follower_id = auth.uid()
  AND f.relationship_state = 'active'
  AND pr.followers_count >= 10000
  AND p.created_at < :cursor
ORDER BY p.created_at DESC
LIMIT 20;
```

### 10.2 Mutual Follow Suggestions (Anti-join pattern)
```sql
-- "People you may know" — friends of friends, excluding already-followed
SELECT DISTINCT
  p.id, p.username, p.display_name, p.avatar_url, p.followers_count
FROM followers f1
JOIN followers f2 ON f2.follower_id = f1.followed_id  -- 2nd degree connections
JOIN profiles p   ON p.id = f2.followed_id
WHERE f1.follower_id = auth.uid()
  AND p.id <> auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM followers
    WHERE follower_id = auth.uid()
      AND followed_id = p.id
  )
ORDER BY p.followers_count DESC
LIMIT 10;
```

### 10.3 Full-Text Search
```sql
-- Correct: uses GIN index on tsvector (never LIKE '%term%')
SELECT id, content, author_id, likes_count, created_at,
  ts_rank(search_vector, query) AS rank
FROM posts,
  plainto_tsquery('english', :search_term) AS query
WHERE search_vector @@ query
  AND visibility = 'public'
ORDER BY rank DESC, created_at DESC
LIMIT 20;
```

---

## 11. RLS ANTI-PATTERNS — FORBIDDEN

The following patterns are explicitly forbidden. The AI agent must never generate
code that produces these scenarios:

| Anti-Pattern | Why Forbidden | Correct Approach |
|---|---|---|
| Circular RLS dependencies | `profiles` policy references `followers`, `followers` policy references `profiles` → infinite recursion, query crash | Ensure RLS policies form a DAG — no circular references |
| Unindexed policy columns | `EXISTS (SELECT 1 FROM followers WHERE follower_id = auth.uid() ...)` without index on `follower_id` → sequential scan × every row | Every column in USING/WITH CHECK clauses MUST have a B-Tree index |
| `anon` role triggering heavy policies | Forgetting `TO authenticated` on expensive subquery policies → DoS vector via unauthenticated requests | Always scope expensive policies with `TO authenticated` |
| Service key in client code | Embedding `service_role` key in frontend env vars → bypasses all RLS | Service role used only in server-side SECURITY DEFINER functions |
| `SELECT *` inside RLS policies | Fetches all columns including sensitive ones in subqueries | Always `SELECT 1` in EXISTS subqueries inside policies |

---

## 12. TABLE SUMMARY

| Table | Rows (est. 100K users) | PK Type | RLS | Key Index |
|---|---|---|---|---|
| `profiles` | 100K | UUIDv7 | ✅ | `lower(username)` UNIQUE |
| `posts` | 2M | UUIDv7 | ✅ | `(author_id, created_at DESC)` |
| `post_likes` | 20M | Composite | ✅ | `(post_id, created_at DESC)` |
| `comments` | 8M | UUIDv7 | ✅ | `(post_id, created_at ASC)` |
| `followers` | 5M | Composite | ✅ | `follower_id`, `followed_id` separate |
| `notifications` | 40M | UUIDv7 | ✅ | `(recipient_id, is_read, created_at)` |
| `conversations` | 500K | UUIDv7 | ✅ | `last_message_at DESC` |
| `conversation_members` | 1M | Composite | ✅ | `user_id` |
| `messages` | 30M | UUIDv7 | ✅ | `(conversation_id, created_at DESC)` |
| `feeds` | 100M | Composite | ✅ | `(owner_id, created_at DESC)` |
| `interest_tags` | 15 (seeded) | UUIDv7 | ✅ | `tag` UNIQUE |
| `user_interests` | 300K | Composite | ✅ | PK covers both directions |

---

*Document Version: 1.0 | Phase 2 complete | Next: GEMINI.md (Phase 3)*