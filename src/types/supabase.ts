export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string
          bio: string | null
          avatar_url: string | null
          cover_url: string | null
          location: string | null
          website: string | null
          date_of_birth: string
          is_private: boolean
          is_verified: boolean
          followers_count: number
          following_count: number
          posts_count: number
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          username: string
          display_name: string
          bio?: string | null
          avatar_url?: string | null
          cover_url?: string | null
          location?: string | null
          website?: string | null
          date_of_birth: string
          is_private?: boolean
          is_verified?: boolean
          followers_count?: number
          following_count?: number
          posts_count?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          display_name?: string
          bio?: string | null
          avatar_url?: string | null
          cover_url?: string | null
          location?: string | null
          website?: string | null
          date_of_birth?: string
          is_private?: boolean
          is_verified?: boolean
          followers_count?: number
          following_count?: number
          posts_count?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      posts: {
        Row: {
          id: string
          author_id: string
          content: string | null
          media_urls: string[]
          visibility: Database['public']['Enums']['post_visibility']
          parent_post_id: string | null
          repost_of_id: string | null
          likes_count: number
          comments_count: number
          reposts_count: number
          views_count: number
          search_vector: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          author_id: string
          content?: string | null
          media_urls?: string[]
          visibility?: Database['public']['Enums']['post_visibility']
          parent_post_id?: string | null
          repost_of_id?: string | null
          likes_count?: number
          comments_count?: number
          reposts_count?: number
          views_count?: number
          search_vector?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          author_id?: string
          content?: string | null
          media_urls?: string[]
          visibility?: Database['public']['Enums']['post_visibility']
          parent_post_id?: string | null
          repost_of_id?: string | null
          likes_count?: number
          comments_count?: number
          reposts_count?: number
          views_count?: number
          search_vector?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'posts_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'posts_parent_post_id_fkey'
            columns: ['parent_post_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'posts_repost_of_id_fkey'
            columns: ['repost_of_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          }
        ]
      }
      post_likes: {
        Row: {
          user_id: string
          post_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          post_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          post_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'post_likes_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'post_likes_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      comments: {
        Row: {
          id: string
          post_id: string
          author_id: string
          parent_comment_id: string | null
          content: string
          likes_count: number
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          author_id: string
          parent_comment_id?: string | null
          content: string
          likes_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          author_id?: string
          parent_comment_id?: string | null
          content?: string
          likes_count?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'comments_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_parent_comment_id_fkey'
            columns: ['parent_comment_id']
            isOneToOne: false
            referencedRelation: 'comments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          }
        ]
      }
      followers: {
        Row: {
          follower_id: string
          followed_id: string
          relationship_state: Database['public']['Enums']['follow_state']
          created_at: string
        }
        Insert: {
          follower_id: string
          followed_id: string
          relationship_state?: Database['public']['Enums']['follow_state']
          created_at?: string
        }
        Update: {
          follower_id?: string
          followed_id?: string
          relationship_state?: Database['public']['Enums']['follow_state']
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'followers_followed_id_fkey'
            columns: ['followed_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'followers_follower_id_fkey'
            columns: ['follower_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          recipient_id: string
          actor_id: string | null
          action_type: Database['public']['Enums']['notification_action']
          entity_type: string
          entity_id: string | null
          payload: Json | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          recipient_id: string
          actor_id?: string | null
          action_type: Database['public']['Enums']['notification_action']
          entity_type: string
          entity_id?: string | null
          payload?: Json | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          recipient_id?: string
          actor_id?: string | null
          action_type?: Database['public']['Enums']['notification_action']
          entity_type?: string
          entity_id?: string | null
          payload?: Json | null
          is_read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_recipient_id_fkey'
            columns: ['recipient_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      conversations: {
        Row: {
          id: string
          created_at: string
          last_message_at: string
        }
        Insert: {
          id?: string
          created_at?: string
          last_message_at?: string
        }
        Update: {
          id?: string
          created_at?: string
          last_message_at?: string
        }
        Relationships: []
      }
      conversation_members: {
        Row: {
          conversation_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          conversation_id: string
          user_id: string
          joined_at?: string
        }
        Update: {
          conversation_id?: string
          user_id?: string
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'conversation_members_conversation_id_fkey'
            columns: ['conversation_id']
            isOneToOne: false
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'conversation_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string
          state: Database['public']['Enums']['message_state']
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content: string
          state?: Database['public']['Enums']['message_state']
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          content?: string
          state?: Database['public']['Enums']['message_state']
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey'
            columns: ['conversation_id']
            isOneToOne: false
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_sender_id_fkey'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      feeds: {
        Row: {
          owner_id: string
          post_id: string
          created_at: string
        }
        Insert: {
          owner_id: string
          post_id: string
          created_at?: string
        }
        Update: {
          owner_id?: string
          post_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'feeds_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'feeds_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          }
        ]
      }
      interest_tags: {
        Row: {
          id: string
          tag: string
          category: string
        }
        Insert: {
          id?: string
          tag: string
          category: string
        }
        Update: {
          id?: string
          tag?: string
          category?: string
        }
        Relationships: []
      }
      user_interests: {
        Row: {
          user_id: string
          tag_id: string
        }
        Insert: {
          user_id: string
          tag_id: string
        }
        Update: {
          user_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_interests_tag_id_fkey'
            columns: ['tag_id']
            isOneToOne: false
            referencedRelation: 'interest_tags'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_interests_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      uuid_generate_v7: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      post_visibility: 'public' | 'followers' | 'private'
      follow_state: 'active' | 'pending' | 'blocked'
      message_state: 'sent' | 'delivered' | 'read' | 'failed'
      notification_action:
        | 'like'
        | 'comment'
        | 'reply'
        | 'follow'
        | 'follow_request'
        | 'follow_approved'
        | 'repost'
        | 'mention'
        | 'system'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]
export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

export type InsertOf<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateOf<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type RowOf<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
