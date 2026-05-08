# @codihaus/fetchpipe — Agent Guide

Use this guide when building API connectors with `@codihaus/fetchpipe`.

## Install

```bash
npm install @codihaus/fetchpipe
```

## Core Concepts

1. **`createClient(url)`** — creates a base client with `.with()` for composing plugins
2. **Plugins** — `rest()`, `bearerAuth()`, `sessionAuth()`, `retry()`, `logger()`
3. **Commands** — functions returning `RequestOptions` (path, method, params, body, headers)
4. **Decorators** — `withHeaders()`, `withToken()`, `withOptions()` to modify commands without mutation

## Plugin Composition Order

```
rest()         → FIRST — provides .request()
bearerAuth()   → any position — auto-discovered by rest() via duck typing
sessionAuth()  → any position — same as bearerAuth
retry()        → AFTER rest() — wraps .request()
logger()       → LAST — wraps outermost (onion model)
```

## Response Extraction

```ts
rest()                                   // default: parse JSON
rest({ extractResponse: 'json' })        // explicit JSON
rest({ extractResponse: 'wrapped:data' }) // unwrap { data: T } — use for Strapi, Laravel, Directus
rest({ extractResponse: 'raw' })         // return raw Response
rest({ extractResponse: customFn })      // (response: Response) => Promise<T>
```

## Command Pattern

A command is a **zero-argument function** returning `RequestOptions`:

```ts
import type { Command } from '@codihaus/fetchpipe'

interface RequestOptions {
  path: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
  params?: Record<string, any>   // query string — objects become key[subKey], arrays join with comma
  headers?: Record<string, string>
  body?: BodyInit | null
  onRequest?: (init: RequestInit) => RequestInit
  onResponse?: (data: any, init: RequestInit) => any
}

const getUsers = (): Command<User[]> => () => ({
  path: '/users',
  method: 'GET',
})
```

## Error Handling

All HTTP errors throw `ApiError`:

```ts
import { isApiError } from '@codihaus/fetchpipe'

try {
  await api.request(cmd())
} catch (err) {
  if (isApiError(err)) {
    err.message   // first error message
    err.status    // HTTP status code
    err.errors    // ApiErrorDetail[]
    err.response  // raw Response
    err.code      // 'NETWORK_ERROR' for fetch failures
  }
}
```

---

## Example: Strapi v4 API Connector

Strapi v4 wraps responses in `{ data, meta }`. Use `extractResponse: 'wrapped:data'` to auto-unwrap.

### Setup

```ts
// lib/strapi.ts
import { createClient, rest, bearerAuth, retry, logger } from '@codihaus/fetchpipe'

const strapi = createClient('https://cms.example.com/api')
  .with(rest({ extractResponse: 'wrapped:data' }))
  .with(bearerAuth(process.env.STRAPI_API_TOKEN!))
  .with(retry({ maxRetries: 2 }))
  .with(logger())

export { strapi }
```

### Types

```ts
// types/strapi.ts
export interface StrapiEntity<T> {
  id: number
  attributes: T
}

export interface Article {
  title: string
  slug: string
  content: string
  publishedAt: string
  category?: { data: StrapiEntity<Category> | null }
}

export interface Category {
  name: string
  slug: string
}

export interface ContactSubmission {
  name: string
  email: string
  message: string
}

export interface SiteConfig {
  siteName: string
  description: string
  maintenanceMode: boolean
}

export interface MediaFile {
  name: string
  url: string
  mime: string
  size: number
}
```

### Commands

```ts
// commands/strapi.ts
import type { Command } from '@codihaus/fetchpipe'
import type { StrapiEntity, Article, Category, ContactSubmission, SiteConfig, MediaFile } from '../types/strapi'

// GET /articles?populate=category&sort=publishedAt:desc&pagination[page]=1&pagination[pageSize]=25
export const getArticles = (
  page = 1,
  pageSize = 25,
): Command<StrapiEntity<Article>[]> => () => ({
  path: '/articles',
  method: 'GET',
  params: {
    populate: 'category',
    sort: 'publishedAt:desc',
    pagination: { page, pageSize },
  },
})

// GET /articles/:id?populate=category
export const getArticle = (
  id: number,
): Command<StrapiEntity<Article>> => () => ({
  path: `/articles/${id}`,
  method: 'GET',
  params: { populate: 'category' },
})

// GET /categories
export const getCategories = (): Command<StrapiEntity<Category>[]> => () => ({
  path: '/categories',
  method: 'GET',
})

// POST /contact-submissions
export const createContact = (
  payload: ContactSubmission,
): Command<StrapiEntity<ContactSubmission>> => () => ({
  path: '/contact-submissions',
  method: 'POST',
  body: JSON.stringify({ data: payload }),
})

// GET /site-config (single type)
export const getSiteConfig = (): Command<StrapiEntity<SiteConfig>> => () => ({
  path: '/site-config',
  method: 'GET',
})

// PUT /articles/:id
export const updateArticle = (
  id: number,
  payload: Partial<Article>,
): Command<StrapiEntity<Article>> => () => ({
  path: `/articles/${id}`,
  method: 'PUT',
  body: JSON.stringify({ data: payload }),
})

// DELETE /articles/:id
export const deleteArticle = (
  id: number,
): Command<void> => () => ({
  path: `/articles/${id}`,
  method: 'DELETE',
})
```

### Usage

```ts
import { strapi } from './lib/strapi'
import { getArticles, getArticle, createContact, updateArticle, deleteArticle } from './commands/strapi'
import { withHeaders, withOptions } from '@codihaus/fetchpipe'

// List articles
const articles = await strapi.request(getArticles(1, 10))

// Single article
const article = await strapi.request(getArticle(42))

// Create contact with extra header
const contact = await strapi.request(
  withHeaders(createContact({ name: 'John', email: 'john@example.com', message: 'Hello' }), {
    'X-Request-Source': 'website',
  })
)

// Update with timeout
const updated = await strapi.request(
  withOptions(updateArticle(42, { title: 'New Title' }), {
    signal: AbortSignal.timeout(5000),
  })
)

// Delete
await strapi.request(deleteArticle(42))
```

### File Upload (multipart)

```ts
// Set Content-Type to 'multipart/form-data' — fetchpipe auto-removes it so the browser sets the boundary
export const uploadMedia = (file: File, folder?: string): Command<MediaFile[]> => () => {
  const form = new FormData()
  form.append('files', file)
  if (folder) form.append('path', folder)

  return {
    path: '/upload',
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data' },
    body: form,
  }
}
```

## Rules for Agents

1. Always define commands as **named factory functions** returning `Command<T>`, not inline objects
2. Use `extractResponse: 'wrapped:data'` for APIs that wrap responses (Strapi, Directus, Laravel)
3. Use `extractResponse: 'json'` (default) for APIs returning flat JSON
4. `body` must be serialized — use `JSON.stringify()` for JSON payloads
5. For file uploads, set `Content-Type: 'multipart/form-data'` and pass `FormData` as body — fetchpipe deletes the header so the runtime sets the correct boundary
6. `params` supports nested objects (`{ pagination: { page: 1 } }` → `pagination[page]=1`) and arrays (`[1,2]` → `1,2`)
7. Compose `retry()` and `logger()` **after** `rest()` — they wrap `.request()`
8. Use `withHeaders()`, `withToken()`, `withOptions()` to decorate commands per-request without mutating the original
9. Handle errors with `isApiError(err)` — check `err.status` for HTTP codes, `err.code` for network failures
