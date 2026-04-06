-- ============================================================
-- Pulse Social Platform - Initial Schema Migration
-- Version: 1.0 | Phase: MVP
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS & GLOBAL SETUP
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

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

-- ============================================================
-- 2. CUSTOM ENUM TYPES
-- ============================================================

CREATE TYPE post_visibility AS ENUM ('public', 'followers', 'private');

CREATE TYPE follow_state AS ENUM ('active', 'pending', 'blocked');

CREATE TYPE message_state AS ENUM ('sent', 'delivered', 'read', 'failed');

CREATE TYPE notification_action AS ENUM (
  'like', 'comment', 'reply', 'follow', 'follow_request',
  'follow_approved', 'repost', 'mention', 'system'
);

-- ============================================================
-- 3. TABLES
-- ============================================================

-- 3.1 PROFILES TABLE
CREATE TABLE profiles (
  id                uuid          PRIMARY KEY DEFAULT uuid_generate_v7(),
  username          text          NOT NULL,
  display_name      text          NOT NULL,
  bio               text,
  avatar_url        text,
  cover_url         text,
  location          text,
  website           text,
  date_of_birth     date          NOT NULL,
  is_private        boolean       NOT NULL DEFAULT false,
  is_verified       boolean       NOT NULL DEFAULT false,
  followers_count   integer       NOT NULL DEFAULT 0 CHECK (followers_count >= 0),
  following_count   integer       NOT NULL DEFAULT 0 CHECK (following_count >= 0),
  posts_count       integer       NOT NULL DEFAULT 0 CHECK (posts_count >= 0),
  metadata          jsonb,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT profiles_username_length    CHECK (char_length(username) BETWEEN 3 AND 30),
  CONSTRAINT profiles_username_format    CHECK (username ~ '^[a-zA-Z0-9_]+$'),
  CONSTRAINT profiles_display_name_len   CHECK (char_length(display_name) <= 60),
  CONSTRAINT profiles_bio_length         CHECK (char_length(bio) <= 160),
  CONSTRAINT profiles_website_format     CHECK (website IS NULL OR website ~ '^https?://'),
  UNIQUE (username)
);

ALTER TABLE profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3.2 POSTS TABLE
CREATE TABLE posts (
  id              uuid            PRIMARY KEY DEFAULT uuid_generate_v7(),
  author_id       uuid            NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content         text,
  media_urls      text[]          DEFAULT '{}',
  visibility      post_visibility NOT NULL DEFAULT 'public',
  parent_post_id  uuid            REFERENCES posts(id) ON DELETE SET NULL,
  repost_of_id    uuid            REFERENCES posts(id) ON DELETE SET NULL,
  likes_count     integer         NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  comments_count  integer         NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  reposts_count   integer         NOT NULL DEFAULT 0 CHECK (reposts_count >= 0),
  views_count     integer         NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  search_vector   tsvector,
  created_at      timestamptz     NOT NULL DEFAULT now(),
  updated_at      timestamptz     NOT NULL DEFAULT now(),
  CONSTRAINT posts_not_empty CHECK (
    content IS NOT NULL AND char_length(content) > 0
    OR array_length(media_urls, 1) > 0
  ),
  CONSTRAINT posts_content_length CHECK (char_length(content) <= 500),
  CONSTRAINT posts_media_limit    CHECK (array_length(media_urls, 1) <= 4)
);

-- 3.3 POST_LIKES TABLE
CREATE TABLE post_likes (
  user_id     uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id     uuid          NOT NULL REFERENCES posts(id)    ON DELETE CASCADE,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- 3.4 COMMENTS TABLE
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

-- 3.5 FOLLOWERS TABLE
CREATE TABLE followers (
  follower_id           uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  followed_id           uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  relationship_state    follow_state  NOT NULL DEFAULT 'active',
  created_at            timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CONSTRAINT followers_no_self_follow CHECK (follower_id <> followed_id)
);

-- 3.6 NOTIFICATIONS TABLE
CREATE TABLE notifications (
  id            uuid                  PRIMARY KEY DEFAULT uuid_generate_v7(),
  recipient_id  uuid                  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id      uuid                  REFERENCES profiles(id) ON DELETE SET NULL,
  action_type   notification_action   NOT NULL,
  entity_type   text                  NOT NULL,
  entity_id     uuid,
  payload       jsonb,
  is_read       boolean               NOT NULL DEFAULT false,
  created_at    timestamptz           NOT NULL DEFAULT now(),
  CONSTRAINT notifications_no_self CHECK (actor_id IS NULL OR actor_id <> recipient_id)
);

-- 3.7 CONVERSATIONS TABLE
CREATE TABLE conversations (
  id                uuid          PRIMARY KEY DEFAULT uuid_generate_v7(),
  created_at        timestamptz   NOT NULL DEFAULT now(),
  last_message_at   timestamptz   NOT NULL DEFAULT now()
);

-- 3.8 CONVERSATION_MEMBERS TABLE
CREATE TABLE conversation_members (
  conversation_id   uuid          NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id           uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at         timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- 3.9 MESSAGES TABLE
CREATE TABLE messages (
  id                uuid            PRIMARY KEY DEFAULT uuid_generate_v7(),
  conversation_id   uuid            NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id         uuid            NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content           text            NOT NULL,
  state             message_state   NOT NULL DEFAULT 'sent',
  created_at        timestamptz     NOT NULL DEFAULT now(),
  CONSTRAINT messages_content_length CHECK (char_length(content) BETWEEN 1 AND 2000)
);

-- 3.10 FEEDS TABLE
CREATE TABLE feeds (
  owner_id    uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id     uuid          NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at  timestamptz   NOT NULL,
  PRIMARY KEY (owner_id, post_id)
);

-- 3.11 INTEREST_TAGS TABLE
CREATE TABLE interest_tags (
  id        uuid    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tag       text    NOT NULL,
  category  text    NOT NULL,
  UNIQUE (tag)
);

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

-- 3.12 USER_INTERESTS TABLE
CREATE TABLE user_interests (
  user_id   uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tag_id    uuid    NOT NULL REFERENCES interest_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, tag_id)
);

-- ============================================================
-- 4. INDEXES
-- ============================================================

-- profiles indexes
CREATE UNIQUE INDEX idx_profiles_username ON profiles (lower(username));
CREATE INDEX idx_profiles_verified ON profiles (is_verified, followers_count DESC)
  WHERE is_verified = true;
CREATE INDEX idx_profiles_dob ON profiles (date_of_birth);
CREATE INDEX idx_profiles_metadata ON profiles USING GIN (metadata jsonb_path_ops);

-- posts indexes
CREATE INDEX idx_posts_author_created ON posts (author_id, created_at DESC);
CREATE INDEX idx_posts_visibility_author ON posts (visibility, author_id, created_at DESC);
CREATE INDEX idx_posts_parent ON posts (parent_post_id, created_at ASC)
  WHERE parent_post_id IS NOT NULL;
CREATE INDEX idx_posts_repost_of ON posts (repost_of_id)
  WHERE repost_of_id IS NOT NULL;
CREATE INDEX idx_posts_search ON posts USING GIN (search_vector)
  WITH (fastupdate = on);

-- post_likes indexes
CREATE INDEX idx_post_likes_post_id ON post_likes (post_id, created_at DESC);

-- comments indexes
CREATE INDEX idx_comments_post_id ON comments (post_id, created_at ASC)
  WHERE parent_comment_id IS NULL;
CREATE INDEX idx_comments_parent ON comments (parent_comment_id, created_at ASC)
  WHERE parent_comment_id IS NOT NULL;

-- followers indexes
CREATE INDEX idx_followers_follower_id ON followers (follower_id, relationship_state);
CREATE INDEX idx_followers_followed_id ON followers (followed_id, relationship_state);
CREATE INDEX idx_followers_pending ON followers (followed_id, created_at DESC)
  WHERE relationship_state = 'pending';

-- notifications indexes
CREATE INDEX idx_notifications_recipient ON notifications (recipient_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications (recipient_id)
  WHERE is_read = false;

-- conversations & messages indexes
CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at DESC);
CREATE INDEX idx_conversation_members_user ON conversation_members (user_id);
CREATE INDEX idx_conversations_last_message ON conversations (last_message_at DESC);

-- feeds indexes
CREATE INDEX idx_feeds_owner_created ON feeds (owner_id, created_at DESC);

-- ============================================================
-- 5. TRIGGERS & FUNCTIONS
-- ============================================================

-- 5.1 posts_search_vector_trigger
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

-- 5.2 post_likes_count_trigger (with notification queue)
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
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

-- 5.3 comments_count_trigger
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

-- 5.4 followers_count_trigger
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.relationship_state = 'active' THEN
    UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.followed_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.relationship_state = 'pending' AND NEW.relationship_state = 'active' THEN
      UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.followed_id;
      UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    END IF;
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

-- 5.5 messages_update_conversation_trigger
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

-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- profiles RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_public"
ON profiles FOR SELECT
USING (true);

CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own"
ON profiles FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- posts RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts_select_visibility"
ON posts FOR SELECT
USING (
  author_id = auth.uid()
  OR visibility = 'public'
  OR (
    visibility = 'followers'
    AND EXISTS (
      SELECT 1 FROM followers
      WHERE follower_id = auth.uid()
        AND followed_id = posts.author_id
        AND relationship_state = 'active'
    )
  )
);

CREATE POLICY "posts_insert_own"
ON posts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "posts_update_own"
ON posts FOR UPDATE
TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "posts_delete_own"
ON posts FOR DELETE
TO authenticated
USING (auth.uid() = author_id);

-- post_likes RLS
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
  AND auth.uid() <> (SELECT author_id FROM posts WHERE id = post_id)
);

CREATE POLICY "post_likes_delete"
ON post_likes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- comments RLS
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

-- followers RLS
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "followers_select"
ON followers FOR SELECT
USING (
  follower_id = auth.uid()
  OR followed_id = auth.uid()
  OR relationship_state = 'active'
);

CREATE POLICY "followers_insert"
ON followers FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "followers_update"
ON followers FOR UPDATE
TO authenticated
USING (
  auth.uid() = follower_id
  OR auth.uid() = followed_id
);

CREATE POLICY "followers_delete"
ON followers FOR DELETE
TO authenticated
USING (
  auth.uid() = follower_id
  OR auth.uid() = followed_id
);

-- notifications RLS
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

-- conversations RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

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

-- conversation_members RLS
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversation_members_select"
ON conversation_members FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- messages RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

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

-- feeds RLS
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feeds_select_own"
ON feeds FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- interest_tags RLS
ALTER TABLE interest_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interest_tags_select_all"
ON interest_tags FOR SELECT
USING (true);

-- user_interests RLS
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

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

-- ============================================================
-- Migration Complete
-- ============================================================
