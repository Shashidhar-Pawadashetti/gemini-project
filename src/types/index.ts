export type PostVisibility = 'public' | 'followers' | 'private';
export type FollowState = 'active' | 'pending' | 'blocked';
export type MessageState = 'sent' | 'delivered' | 'read' | 'failed';
export type NotificationAction = 
  | 'like' 
  | 'comment' 
  | 'reply' 
  | 'follow' 
  | 'follow_request'
  | 'follow_approved' 
  | 'repost' 
  | 'mention' 
  | 'system';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  location: string | null;
  website: string | null;
  is_private: boolean;
  is_verified: boolean;
  followers_count: number;
  following_count: number;
  posts_count: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  content: string | null;
  media_urls: string[];
  visibility: PostVisibility;
  parent_post_id: string | null;
  repost_of_id: string | null;
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  views_count: number;
  created_at: string;
  author?: Profile;
  is_liked_by_me?: boolean;
  is_reposted_by_me?: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  content: string;
  likes_count: number;
  created_at: string;
  author?: Profile;
}

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  action_type: NotificationAction;
  entity_type: string;
  entity_id: string | null;
  payload: {
    actor_username?: string;
    actor_avatar_url?: string | null;
    post_preview?: string | null;
  } | null;
  is_read: boolean;
  created_at: string;
  actor?: Profile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  state: MessageState;
  created_at: string;
  sender?: Profile;
}

export interface Conversation {
  id: string;
  created_at: string;
  last_message_at: string;
  members?: Profile[];
  last_message?: Message;
}

export interface InterestTag {
  id: string;
  tag: string;
  category: string;
}

export interface APIError {
  error: string;
  message: string;
  status: number;
}

export interface FeedResponse {
  posts: Post[];
  next_cursor: string | null;
}

export interface SearchResponse {
  users: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'is_verified' | 'followers_count'>[];
  posts: Pick<Post, 'id' | 'content' | 'author' | 'likes_count' | 'created_at'>[];
  tags: { tag: string; post_count: number }[];
}
