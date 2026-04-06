-- ============================================================
-- Pulse Social Platform - Block Functions Migration
-- Version: 1.1 | Adds block/unblock functionality
-- ============================================================

CREATE OR REPLACE FUNCTION block_user(blocker_id uuid, blocked_id uuid)
RETURNS void AS $$
BEGIN
  DELETE FROM followers WHERE (follower_id = blocker_id AND followed_id = blocked_id)
     OR (follower_id = blocked_id AND followed_id = blocker_id);
  
  INSERT INTO followers (follower_id, followed_id, relationship_state)
  VALUES (blocker_id, blocked_id, 'blocked');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION unblock_user(blocker_id uuid, blocked_id uuid)
RETURNS void AS $$
BEGIN
  DELETE FROM followers WHERE follower_id = blocker_id AND followed_id = blocked_id AND relationship_state = 'blocked';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Migration Complete
-- ============================================================
