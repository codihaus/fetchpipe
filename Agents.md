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

## Connector Folder Structure

Group commands by **operation** → **resource**. Each resource is one file. Re-export everything from barrel `index.ts`.

```
strapi/
├── init.ts                     # createClient + plugins
├── index.ts                    # barrel — re-exports init + all commands
├── types/
│   ├── index.ts
│   ├── article.ts
│   ├── category.ts
│   ├── contact.ts
│   ├── config.ts
│   └── media.ts
└── commands/
    ├── index.ts                # barrel — re-exports all commands
    ├── read/
    │   ├── article.ts          # getArticles, getArticle, getArticleBySlug
    │   ├── category.ts         # getCategories, getCategory
    │   └── config.ts           # getSiteConfig
    ├── create/
    │   ├── article.ts          # createArticle
    │   ├── contact.ts          # createContact
    │   └── media.ts            # uploadMedia
    ├── update/
    │   ├── article.ts          # updateArticle
    │   └── config.ts           # updateSiteConfig
    └── delete/
        └── article.ts          # deleteArticle
```

**Naming conventions:**
- `init.ts` — client setup only, no commands
- `types/` — one file per resource, barrel re-exports all
- `commands/<operation>/<resource>.ts` — one file per resource per operation
- Operation folders: `read`, `create`, `update`, `delete`
- Command names: `<verb><Resource>` — `getArticles`, `createContact`, `updateArticle`, `deleteArticle`

---

## Example: Strapi v4 API Connector

Strapi v4 wraps responses in `{ data, meta }`. Use `extractResponse: 'wrapped:data'` to auto-unwrap.

### `strapi/init.ts`

```ts
import { createClient, rest, bearerAuth, retry, logger } from '@codihaus/fetchpipe'

export const strapi = createClient('https://cms.example.com/api')
  .with(rest({ extractResponse: 'wrapped:data' }))
  .with(bearerAuth(process.env.STRAPI_API_TOKEN!))
  .with(retry({ maxRetries: 2 }))
  .with(logger())
```

### `strapi/types/article.ts`

```ts
import type { StrapiEntity, Category } from './index'

export interface Article {
  title: string
  slug: string
  content: string
  publishedAt: string
  category?: { data: StrapiEntity<Category> | null }
}
```

### `strapi/types/category.ts`

```ts
export interface Category {
  name: string
  slug: string
}
```

### `strapi/types/contact.ts`

```ts
export interface ContactSubmission {
  name: string
  email: string
  message: string
}
```

### `strapi/types/config.ts`

```ts
export interface SiteConfig {
  siteName: string
  description: string
  maintenanceMode: boolean
}
```

### `strapi/types/media.ts`

```ts
export interface MediaFile {
  name: string
  url: string
  mime: string
  size: number
}
```

### `strapi/types/index.ts`

```ts
export interface StrapiEntity<T> {
  id: number
  attributes: T
}

export type { Article } from './article'
export type { Category } from './category'
export type { ContactSubmission } from './contact'
export type { SiteConfig } from './config'
export type { MediaFile } from './media'
```

### `strapi/commands/read/article.ts`

```ts
import type { Command } from '@codihaus/fetchpipe'
import type { StrapiEntity, Article } from '../../types'

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

export const getArticle = (
  id: number,
): Command<StrapiEntity<Article>> => () => ({
  path: `/articles/${id}`,
  method: 'GET',
  params: { populate: 'category' },
})

export const getArticleBySlug = (
  slug: string,
): Command<StrapiEntity<Article>[]> => () => ({
  path: '/articles',
  method: 'GET',
  params: {
    'filters[slug][$eq]': slug,
    populate: 'category',
  },
})
```

### `strapi/commands/read/category.ts`

```ts
import type { Command } from '@codihaus/fetchpipe'
import type { StrapiEntity, Category } from '../../types'

export const getCategories = (): Command<StrapiEntity<Category>[]> => () => ({
  path: '/categories',
  method: 'GET',
})

export const getCategory = (
  id: number,
): Command<StrapiEntity<Category>> => () => ({
  path: `/categories/${id}`,
  method: 'GET',
})
```

### `strapi/commands/read/config.ts`

```ts
import type { Command } from '@codihaus/fetchpipe'
import type { StrapiEntity, SiteConfig } from '../../types'

export const getSiteConfig = (): Command<StrapiEntity<SiteConfig>> => () => ({
  path: '/site-config',
  method: 'GET',
})
```

### `strapi/commands/create/article.ts`

```ts
import type { Command } from '@codihaus/fetchpipe'
import type { StrapiEntity, Article } from '../../types'

export const createArticle = (
  payload: Omit<Article, 'publishedAt'>,
): Command<StrapiEntity<Article>> => () => ({
  path: '/articles',
  method: 'POST',
  body: JSON.stringify({ data: payload }),
})
```

### `strapi/commands/create/contact.ts`

```ts
import type { Command } from '@codihaus/fetchpipe'
import type { StrapiEntity, ContactSubmission } from '../../types'

export const createContact = (
  payload: ContactSubmission,
): Command<StrapiEntity<ContactSubmission>> => () => ({
  path: '/contact-submissions',
  method: 'POST',
  body: JSON.stringify({ data: payload }),
})
```

### `strapi/commands/create/media.ts`

```ts
import type { Command } from '@codihaus/fetchpipe'
import type { MediaFile } from '../../types'

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

### `strapi/commands/update/article.ts`

```ts
import type { Command } from '@codihaus/fetchpipe'
import type { StrapiEntity, Article } from '../../types'

export const updateArticle = (
  id: number,
  payload: Partial<Article>,
): Command<StrapiEntity<Article>> => () => ({
  path: `/articles/${id}`,
  method: 'PUT',
  body: JSON.stringify({ data: payload }),
})
```

### `strapi/commands/update/config.ts`

```ts
import type { Command } from '@codihaus/fetchpipe'
import type { StrapiEntity, SiteConfig } from '../../types'

export const updateSiteConfig = (
  payload: Partial<SiteConfig>,
): Command<StrapiEntity<SiteConfig>> => () => ({
  path: '/site-config',
  method: 'PUT',
  body: JSON.stringify({ data: payload }),
})
```

### `strapi/commands/delete/article.ts`

```ts
import type { Command } from '@codihaus/fetchpipe'

export const deleteArticle = (id: number): Command<void> => () => ({
  path: `/articles/${id}`,
  method: 'DELETE',
})
```

### `strapi/commands/index.ts`

```ts
export { getArticles, getArticle, getArticleBySlug } from './read/article'
export { getCategories, getCategory } from './read/category'
export { getSiteConfig } from './read/config'
export { createArticle } from './create/article'
export { createContact } from './create/contact'
export { uploadMedia } from './create/media'
export { updateArticle } from './update/article'
export { updateSiteConfig } from './update/config'
export { deleteArticle } from './delete/article'
```

### `strapi/index.ts`

```ts
export { strapi } from './init'
export * from './commands'
export type * from './types'
```

### Usage

```ts
import { strapi, getArticles, getArticle, createContact, updateArticle, deleteArticle } from './strapi'
import { withHeaders, withOptions } from '@codihaus/fetchpipe'

const articles = await strapi.request(getArticles(1, 10))

const article = await strapi.request(getArticle(42))

const contact = await strapi.request(
  withHeaders(createContact({ name: 'John', email: 'john@example.com', message: 'Hello' }), {
    'X-Request-Source': 'website',
  })
)

const updated = await strapi.request(
  withOptions(updateArticle(42, { title: 'New Title' }), {
    signal: AbortSignal.timeout(5000),
  })
)

await strapi.request(deleteArticle(42))
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
