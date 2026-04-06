# GEMINI.md — Database Layer Context
## Scope: src/lib/supabase/ and src/app/api/
## Loaded automatically when agent accesses any file in these directories

---

> This file supplements the root GEMINI.md with rules specific to the database
> and API layer. All root rules still apply. These rules are additive.

---

## DATABASE ACCESS RULES

### Client Selection (critical)
```typescript
// In src/app/api/** and src/app/**/page.tsx (server):
import { createServerClient } from '@/lib/supabase/server'
const supabase = createServerClient()

// In src/components/** with 'use client' directive:
import { createBrowserClient } from '@/lib/supabase/client'
const supabase = createBrowserClient()
```

Never mix these. If you are unsure which to use, ask.

### Query Rules
- Always specify columns: `supabase.from('posts').select('id, content, author_id, created_at')`
- Always add `.limit()` to any query that returns multiple rows — default to 20.
- Always add `.order()` with a column and `ascending: false` for feeds, `true` for threads.
- Cursor-based pagination: `.lt('created_at', cursor)` — never `.range(offset, offset+19)`.
- Use `.maybeSingle()` when a query might return 0 rows — never `.single()` which throws on 0 rows.

### RLS Verification Checklist
Before writing any query, verify:
- [ ] The table has RLS enabled (check schema.md section for that table)
- [ ] The policy permits the operation you're performing (SELECT / INSERT / UPDATE / DELETE)
- [ ] The correct client (server/browser) is being used for the auth context
- [ ] You are NOT using the service role key in a client-accessible code path

### Forbidden Query Patterns
```typescript
// FORBIDDEN — sequential scan, never use LIKE with leading wildcard
.ilike('content', '%searchterm%')

// CORRECT — uses GIN index on tsvector
.textSearch('search_vector', searchTerm, { type: 'websearch' })

// FORBIDDEN — offset pagination
.range(20, 39)

// CORRECT — cursor pagination
.lt('created_at', cursor).order('created_at', { ascending: false }).limit(20)

// FORBIDDEN — fetches all columns
.select('*')

// CORRECT — explicit columns
.select('id, content, author_id, likes_count, created_at')
```

---

## API ROUTE RULES

Every file in `src/app/api/` must follow this exact structure:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

// 1. Input validation schema (always validate before touching DB)
const RequestSchema = z.object({ ... })

export async function POST(request: NextRequest) {
  try {
    // 2. Authenticate first — never skip this
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required', status: 401 },
        { status: 401 }
      )
    }

    // 3. Parse and validate input
    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: parsed.error.message, status: 422 },
        { status: 422 }
      )
    }

    // 4. Database operation
    const { data, error } = await supabase.from('...').insert({ ... })
    if (error) throw error

    // 5. Return typed response
    return NextResponse.json(data, { status: 201 })

  } catch (error) {
    console.error('[API /route]:', error)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    )
  }
}
```

---

## REALTIME SUBSCRIPTION PATTERN

```typescript
// Always in a useEffect — always clean up
useEffect(() => {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    }, (payload) => {
      // Handle new message
    })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)  // Always clean up
  }
}, [conversationId])
```

Never subscribe to an entire table without a filter.
Never leave subscriptions active after component unmount.

---

*Sub-directory context v1.0 — loaded JIT when agent accesses src/lib/supabase/ or src/app/api/*