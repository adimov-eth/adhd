---
title: "OpenCode Claude Pro/Max OAuth Implementation"
source: "https://github.com/sst/opencode-anthropic-auth"
created: 2026-01-04
tags:
  - "clippings"
  - "oauth"
  - "anthropic"
---

# OpenCode Claude Pro/Max OAuth Implementation

OpenCode enables using Claude Pro/Max subscriptions instead of API keys through Anthropic's OAuth 2.0 infrastructure.

## Core Discovery

OpenCode uses the **same OAuth client ID as Claude Code CLI**:

```
9d1c250a-e61b-44d9-88ed-5944d1962f5e
```

This client ID is public (visible in open source code, GitHub issues, multiple third-party implementations) and appears to be Anthropic's sanctioned client ID for coding tool integrations.

## Key Components

| Component | Value/Location |
|-----------|----------------|
| Client ID | `9d1c250a-e61b-44d9-88ed-5944d1962f5e` |
| Auth URL (Pro/Max) | `https://claude.ai/oauth/authorize` |
| Auth URL (Console) | `https://console.anthropic.com/oauth/authorize` |
| Token URL | `https://console.anthropic.com/v1/oauth/token` |
| Redirect URI | `https://console.anthropic.com/oauth/code/callback` |
| OAuth Scopes | `org:create_api_key user:profile user:inference` |
| Required Beta Header | `anthropic-beta: oauth-2025-04-20` |

## OAuth Flow (PKCE)

### 1. Generate PKCE Challenge

```typescript
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64url.encode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url.encode(new Uint8Array(hash));
}
```

### 2. Build Authorization URL

```typescript
const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";

function buildAuthUrl(codeChallenge: string, mode: "max" | "console"): string {
  const baseUrl = mode === "max"
    ? "https://claude.ai/oauth/authorize"
    : "https://console.anthropic.com/oauth/authorize";

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: "https://console.anthropic.com/oauth/code/callback",
    scope: "org:create_api_key user:profile user:inference",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    code: "true"  // Displays code for manual entry
  });

  return `${baseUrl}?${params}`;
}
```

### 3. Exchange Code for Tokens

```typescript
interface OAuthTokens {
  type: "oauth";
  access: string;   // sk-ant-oat01-...
  refresh: string;  // sk-ant-ort01-...
  expires: number;  // Unix timestamp in ms
}

async function exchangeCode(code: string, codeVerifier: string): Promise<OAuthTokens> {
  const response = await fetch("https://console.anthropic.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: code,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
      redirect_uri: "https://console.anthropic.com/oauth/code/callback"
    })
  });

  const data = await response.json();

  return {
    type: "oauth",
    access: data.access_token,
    refresh: data.refresh_token,
    expires: Date.now() + (data.expires_in * 1000)
  };
}
```

### 4. Refresh Expired Tokens

```typescript
async function refreshTokens(refreshToken: string): Promise<OAuthTokens> {
  const response = await fetch("https://console.anthropic.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID
    })
  });

  const data = await response.json();

  // NOTE: Anthropic returns a NEW refresh token each time
  // The old refresh token is invalidated
  return {
    type: "oauth",
    access: data.access_token,
    refresh: data.refresh_token,
    expires: Date.now() + (data.expires_in * 1000)
  };
}
```

## Making API Requests with OAuth

The critical requirement: requests must use Bearer token authentication with the `anthropic-beta: oauth-2025-04-20` header.

```typescript
const headers = {
  "Authorization": `Bearer ${accessToken}`,
  "anthropic-beta": "oauth-2025-04-20",
  "anthropic-version": "2023-06-01",
  "Content-Type": "application/json"
};
```

## Important Notes

1. **Refresh tokens are single-use** - Each refresh returns a NEW refresh token and invalidates the old one.

2. **Beta header is mandatory** - Without `anthropic-beta: oauth-2025-04-20`, you get:
   ```json
   {"error": {"message": "This credential is only authorized for use with Claude Code..."}}
   ```

3. **Zero cost tracking** - When using OAuth (subscription), usage doesn't count against API billing.

4. **Token format**:
   - Access tokens: `sk-ant-oat01-...`
   - Refresh tokens: `sk-ant-ort01-...`

## Personal Use: Getting Tokens

```bash
# Install opencode and authenticate
curl -fsSL https://opencode.ai/install | bash
opencode auth login
# Select "Claude Pro/Max", complete browser flow

# Extract tokens
cat ~/.local/share/opencode/auth.json
```

## References

- [opencode-anthropic-auth source](https://github.com/sst/opencode-anthropic-auth)
- [OpenCode providers documentation](https://opencode.ai/docs/providers/)
