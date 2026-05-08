# fetchpipe

Composable, zero-dependency API client foundation. Build type-safe clients for **any** REST API by plugging together small, focused modules.

![Architecture](https://raw.githubusercontent.com/codihaus/fetchpipe/prod/assets/architecture.png)


## Why

Every new project, you rewrite the same fetch wrapper, token management, retry logic, error handling. Or you reach for axios — then wrap it with another layer for auth, interceptors, error formatting.

`fetchpipe` gives you a single composable foundation that works with any REST API. No framework lock-in, no backend assumptions.

**Compose only what you need.** No retry? Don't add it. Need session auth instead of bearer? Swap the plugin. Each plugin is independent and tree-shakeable.

**Type-safe by design.** Each `.with()` accumulates types through TypeScript intersections — your IDE knows exactly what methods are available based on which plugins you composed. No casting, no `as any`.

**Commands separate "what" from "when".** Define requests as reusable thunks, decorate them without mutation, execute when ready. Build an SDK for your team's API in minutes.

**Runs everywhere.** Uses platform globals (`fetch`, `URL`) — browser, Node, Deno, Bun, React Native. Inject a mock `fetch` for tests.

| | raw fetch | axios | fetchpipe |
|---|---|---|---|
| Auth management | DIY | Interceptor | Built-in plugins |
| Retry | DIY | DIY | Built-in plugin |
| Type inference | No | No | Auto via compose |
| Bundle size | 0 | ~13KB | ~3KB |
| Extensible | Hard | Interceptors | Plugin system |

## Install

```bash
npm install @codihaus/fetchpipe
```

## Quick Start

```ts
import { createClient, rest, bearerAuth, type Command } from '@codihaus/fetchpipe'

const api = createClient('https://api.example.com')
  .with(rest())
  .with(bearerAuth('my-token'))

const getUsers = (): Command<User[]> => () => ({
  path: '/users',
  method: 'GET',
})

const users = await api.request(getUsers())
```

## Plugins

### `rest(config?)`

Core plugin. Adds `.request(command)`.

```ts
createClient(url).with(rest({
  extractResponse: 'json',            // return parsed JSON (default)
  extractResponse: 'wrapped:data',    // unwrap { data: ... }
  extractResponse: 'raw',             // return raw Response
  extractResponse: (res) => { ... },  // custom extractor
  credentials: 'include',
  onRequest: (init) => init,          // global request hook
  onResponse: (data, init) => data,   // global response hook
}))
```

### `bearerAuth(token)`

Static or dynamic bearer token.

```ts
// Static
.with(bearerAuth('my-api-key'))

// Dynamic — called on every request
.with(bearerAuth(async () => await getTokenFromVault()))

// Methods: api.getToken(), api.setToken(token)
```

### `sessionAuth(config?)`

Full auth lifecycle — login, auto-refresh, logout. All paths configurable.

```ts
.with(sessionAuth({
  loginPath: '/auth/login',
  refreshPath: '/auth/refresh',
  logoutPath: '/auth/logout',
  autoRefresh: true,
  msRefreshBeforeExpires: 30000,
  storage: memoryStorage(),       // or custom AuthStorage
}))

await api.login({ email: 'user@example.com', password: 'secret' })
await api.request(protectedCommand())  // token auto-attached
await api.logout()
```

### `retry(config?)` 

Exponential backoff. Must compose **after** `rest()`.

```ts
.with(retry({
  maxRetries: 3,       // default
  baseDelay: 300,      // ms, default
  maxDelay: 10000,     // ms, default
  retryOn: (error, attempt) => error.status >= 500,
}))
```

### `logger(config?)`

Request/response logging. Must compose **after** `rest()`.

```ts
.with(logger({ logRequest: true, logResponse: true, logErrors: true }))
```

## Command Decorators

```ts
import { withHeaders, withToken, withOptions, endpoint } from '@codihaus/fetchpipe'

withHeaders(cmd, { 'X-Custom': 'value' })    // inject headers
withToken(cmd, 'override-token')              // override auth
withOptions(cmd, init => ({ ...init, signal: AbortSignal.timeout(5000) }))
endpoint({ path: '/raw', method: 'POST' })   // command from raw options
```

## Plugin Composition

```ts
const api = createClient(url)
  .with(rest())            // innermost — actual fetch
  .with(bearerAuth(token)) // any order — discovered via duck typing
  .with(retry())           // wraps .request()
  .with(logger())          // wraps outermost (onion model)
```

Rules:
1. `rest()` first — provides `.request()`
2. Auth plugins — any position, adds `getToken()` discovered at runtime
3. Wrapping plugins — after `rest()`, last `.with()` wraps outermost

## Custom Plugins

```ts
const timing = () => <Schema>(client: ApiClient<Schema>) => {
  const original = (client as any).request
  return {
    async request<T>(cmd: Command<T>): Promise<T> {
      const t = performance.now()
      try { return await original.call(this, cmd) }
      finally { console.log(`${(performance.now() - t).toFixed(1)}ms`) }
    },
  }
}
```

## Platform Globals

```ts
createClient(url, {
  globals: { fetch: customFetch, URL: customURL, logger: customLogger },
})
```

## Error Handling

```ts
import { isApiError } from '@codihaus/fetchpipe'

try {
  await api.request(cmd())
} catch (err) {
  if (isApiError(err)) {
    err.message   // first error message
    err.status    // HTTP status
    err.errors    // error details array
    err.response  // raw Response
  }
}
```

## Real-World Examples

```ts
// Mattermost — raw JSON responses
const mm = createClient('https://mm.example.com/api/v4')
  .with(rest({ extractResponse: 'json' }))
  .with(bearerAuth(token))

// Laravel — wrapped { data: ... }
const api = createClient('https://app.example.com/api')
  .with(rest({ extractResponse: 'wrapped:data' }))
  .with(sessionAuth({ credentials: 'include' }))
  .with(retry({ maxRetries: 2 }))

// Internal microservice
const svc = createClient('http://user-service.internal:3000')
  .with(rest())
  .with(bearerAuth(async () => await getServiceToken()))
  .with(retry({ maxRetries: 5, retryOn: (err) => err.status === 503 }))
  .with(logger())
```

## API Reference

| Export | Type | Description |
|--------|------|-------------|
| `createClient(url, opts?)` | Factory | Create base client |
| `rest(config?)` | Plugin | REST transport — `.request()` |
| `bearerAuth(token)` | Plugin | Static/dynamic bearer auth |
| `sessionAuth(config?)` | Plugin | Login/refresh/logout lifecycle |
| `retry(config?)` | Plugin | Exponential backoff retry |
| `logger(config?)` | Plugin | Request/response logging |
| `memoryStorage()` | Utility | In-memory token storage |
| `endpoint(opts)` | Helper | Command from raw options |
| `withHeaders(cmd, h)` | Decorator | Add headers |
| `withToken(cmd, t)` | Decorator | Override auth token |
| `withOptions(cmd, fn)` | Decorator | Transform RequestInit |
| `ApiError` | Class | Structured API error |
| `isApiError(err)` | Guard | Type guard for ApiError |

## Requirements

- Node.js >= 18 (or any runtime with `fetch` + `URL`)
- TypeScript >= 5.0

## License

MIT
