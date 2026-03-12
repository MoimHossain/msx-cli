# How Authentication Works in msx-cli — A Deep Dive

This document explains exactly what happens under the hood when you run `msx-cli login`, step by step, including why the localhost redirect works without a custom app registration and how device compliance is satisfied.

---

## Table of Contents

1. [The Big Picture](#the-big-picture)
2. [Step-by-Step: What Happens When You Run `msx-cli login`](#step-by-step)
3. [Why Does localhost Redirect Work?](#why-localhost-works)
4. [How Device Compliance Gets Through (PRT)](#device-compliance-prt)
5. [Why Device Code Flow Failed (Error 530033)](#why-device-code-failed)
6. [Token Caching & Silent Refresh](#token-caching)
7. [Security Model](#security-model)

---

## The Big Picture <a id="the-big-picture"></a>

We use the **OAuth 2.0 Authorization Code flow with PKCE** (Proof Key for Code Exchange), routed through the **system browser** on your managed Windows device. This is critical because:

- **No custom app registration** is needed — we use Microsoft's well-known first-party client ID for Dynamics 365 (`2ad88395-b77d-4561-9441-d0e40824f9bc`)
- **Device compliance** is satisfied because the system browser (Edge) carries your device's **Primary Refresh Token (PRT)**
- **MFA** is handled natively by the browser's existing session

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   msx-cli   │     │  System Browser   │     │  Microsoft Entra ID │
│  (Node.js)  │     │     (Edge)        │     │  (login.microsoft.  │
│             │     │                    │     │   online.com)       │
└──────┬──────┘     └────────┬───────────┘     └──────────┬──────────┘
       │                     │                            │
  1. Start loopback server   │                            │
     on localhost:random     │                            │
       │                     │                            │
  2. Open browser ──────────►│                            │
     with auth URL           │                            │
       │                     │  3. GET /authorize         │
       │                     │  + PKCE code_challenge     │
       │                     │  + client_id               │
       │                     │  + redirect_uri=           │
       │                     │    localhost:random         │
       │                     │  + x-ms-RefreshToken       │
       │                     │    Credential (PRT cookie) │
       │                     │───────────────────────────►│
       │                     │                            │
       │                     │       4. Validate PRT,     │
       │                     │       device compliance,   │
       │                     │       user identity, MFA   │
       │                     │                            │
       │                     │  5. 302 Redirect to        │
       │                     │◄───────────────────────────│
       │                     │  localhost:random?code=XYZ  │
       │                     │                            │
  6. Receive code ◄──────────│                            │
     on loopback server      │                            │
       │                     │  (shows "✅ Signed in")    │
       │                                                  │
  7. POST /token ────────────────────────────────────────►│
     + code=XYZ                                           │
     + PKCE code_verifier                                 │
     + client_id                                          │
       │                                                  │
  8. Receive tokens ◄─────────────────────────────────────│
     (access_token,                                       │
      refresh_token,                                      │
      id_token)                                           │
       │                                                  │
  9. Cache tokens to                                      │
     ~/.msx-cli/token-cache.json                          │
```

---

## Step-by-Step: What Happens When You Run `msx-cli login` <a id="step-by-step"></a>

### Step 1: PKCE Initialization

MSAL generates a **code verifier** (a cryptographically random string) and a **code challenge** (the SHA-256 hash of the verifier, base64url-encoded). PKCE prevents authorization code interception attacks — even if someone captures the auth code, they can't exchange it without the verifier.

```
code_verifier  = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"  (random)
code_challenge = base64url(SHA256(code_verifier))
               = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
```

### Step 2: Start Loopback Server

MSAL starts a **temporary HTTP server** on `http://localhost:<random_port>`. The port is ephemeral — assigned by the OS (e.g., `http://localhost:52431`). This server exists only to receive the redirect from Entra ID.

```javascript
// Simplified — MSAL does this internally
const server = http.createServer(handleRedirect);
server.listen(0); // OS assigns a random available port
const port = server.address().port; // e.g., 52431
```

### Step 3: Open System Browser

MSAL constructs the authorization URL and opens it in your default system browser (Edge):

```
https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize
  ?client_id=2ad88395-b77d-4561-9441-d0e40824f9bc
  &response_type=code
  &redirect_uri=http://localhost:52431
  &scope=https://microsoftsales.crm.dynamics.com/.default offline_access openid profile
  &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
  &code_challenge_method=S256
  &state=<random_state_value>
```

On Windows, this runs: `start "" "https://login.microsoftonline.com/..."` which opens Edge.

### Step 4: Browser Authenticates (with PRT)

This is the **magic** step. Edge on your managed device does something that device code flow can't:

1. Edge detects you're navigating to `login.microsoftonline.com`
2. Edge communicates with **BrowserCore.exe** (a privileged helper process on Windows)
3. BrowserCore accesses your device's **Primary Refresh Token (PRT)** — a long-lived credential tied to your user+device pair
4. BrowserCore creates a signed JWT called the **PRT cookie**, containing:
   - Your PRT (the refresh token itself)
   - A fresh **nonce** from the server (anti-replay)
   - **Device compliance claims** (device ID, join state, Intune compliance status)
   - Signed with a **session key** (often TPM-bound)
5. This JWT is sent as the `x-ms-RefreshTokenCredential` cookie/header to Entra ID

**This is why device code flow failed** — it runs in a separate browser context where your device's PRT isn't available. The system browser on your managed device IS the place where the PRT lives.

### Step 5: Entra ID Validates Everything

Microsoft Entra ID receives the request and validates:

- ✅ **Client ID** `2ad88395-...` — recognized as the first-party "Dynamics 365 Development Tools" app
- ✅ **User identity** — from the PRT or interactive sign-in
- ✅ **MFA** — already completed (claim carried in PRT or existing session)
- ✅ **Device compliance** — extracted from the PRT cookie's device claims
- ✅ **Conditional Access** — all policies satisfied (managed device ✅, compliant ✅, MFA ✅)
- ✅ **PKCE code challenge** — stored for later verification

### Step 6: Redirect with Authorization Code

Entra ID responds with a `302 Redirect`:

```
HTTP/1.1 302 Found
Location: http://localhost:52431/?code=0.AYIA...long_auth_code...&state=<state>&session_state=...
```

The browser navigates to this URL. Your loopback server (running in msx-cli) receives this HTTP request.

### Step 7: Exchange Code for Tokens

MSAL extracts the `code` from the query string, shuts down the loopback server, and makes a **server-side POST** (no browser involved) to the token endpoint:

```
POST https://login.microsoftonline.com/organizations/oauth2/v2.0/token

client_id=2ad88395-b77d-4561-9441-d0e40824f9bc
&grant_type=authorization_code
&code=0.AYIA...long_auth_code...
&redirect_uri=http://localhost:52431
&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
&scope=https://microsoftsales.crm.dynamics.com/.default offline_access openid profile
```

The **code_verifier** proves we're the same party that initiated the request (PKCE). Without it, the code is useless.

### Step 8: Receive Tokens

Entra ID responds with:

```json
{
  "access_token": "eyJ0eXAiOiJKV1Q...",     // ~1 hour lifetime, scoped to CRM
  "refresh_token": "0.AYIA...",               // long-lived, used for silent refresh
  "id_token": "eyJ0eXAiOiJKV1Q...",          // user identity claims
  "token_type": "Bearer",
  "expires_in": 3599,
  "scope": "https://microsoftsales.crm.dynamics.com/.default"
}
```

### Step 9: Cache & Use

MSAL serializes all tokens to `~/.msx-cli/token-cache.json`. Subsequent commands call `acquireTokenSilent()` which uses the refresh token to get fresh access tokens without any browser interaction.

---

## Why Does localhost Redirect Work? <a id="why-localhost-works"></a>

This is the key surprise — the well-known client ID `2ad88395-b77d-4561-9441-d0e40824f9bc` has `app://5d3e90d6-aa8e-48a8-8f2c-58b45cc67315` as its registered redirect URI. So how does `http://localhost:52431` work?

### RFC 8252 — OAuth 2.0 for Native Apps

The answer is **RFC 8252, Section 7.3**, which Microsoft Entra ID implements:

> *"The authorization server MUST allow any port to be specified at the time of the request for loopback IP redirect URIs, to accommodate clients that obtain an available ephemeral port from the operating system at the time of the request."*

**In practice, Microsoft Entra ID has a special rule:**

- For any application registered as a **public client** (native/desktop app), `http://localhost` redirects are **always allowed**, regardless of what redirect URIs are explicitly registered in the app manifest.
- The port is dynamic and accepted at runtime — you don't need to register `http://localhost:52431` specifically.
- This applies only to `localhost` / `127.0.0.1` / `[::1]` — not to any other hostname.
- `http://` (not `https://`) is specifically permitted for loopback, also per RFC 8252.

### Why is this secure?

1. **Traffic never leaves the machine** — `localhost` is always the local device
2. **Random port** — an attacker can't predict which port the server is on
3. **Ephemeral server** — the server exists only for seconds during auth
4. **PKCE** — even if someone intercepts the code, they can't exchange it without the code_verifier
5. **Only the app that opened the port can read the response**

### The registered redirect URI `app://5d3e90d6-...` is for a different flow

That URI is for the "embedded webview" flow used by older .NET desktop apps (WinForms, WPF). Our loopback flow is an entirely separate mechanism that the Entra identity platform supports in parallel for the same client ID.

---

## How Device Compliance Gets Through (PRT) <a id="device-compliance-prt"></a>

The **Primary Refresh Token (PRT)** is the reason interactive browser login satisfies Conditional Access while device code flow doesn't.

### What is the PRT?

The PRT is a special token issued to a **user+device pair** when:
- The Windows device is **Azure AD joined** or **Hybrid Azure AD joined**
- The user signs into Windows with their work/school account

It's stored securely on the device (often TPM-protected) and managed by the **CloudAP** plugin and **WAM** (Web Account Manager).

### How the PRT travels with browser auth

```
┌────────────┐    ┌───────────────┐    ┌────────────────┐    ┌──────────────┐
│   Edge     │───►│ BrowserCore   │───►│  CloudAP /     │───►│  TPM         │
│  Browser   │    │  .exe         │    │  WAM Plugin    │    │  (optional)  │
│            │◄───│               │◄───│                │◄───│              │
└────────────┘    └───────────────┘    └────────────────┘    └──────────────┘
    │                                                              │
    │  x-ms-RefreshTokenCredential cookie                         │
    │  = signed JWT {                                              │
    │      refresh_token: <PRT>,                                  │
    │      request_nonce: <server_nonce>,                         │
    │      device_id: "e87daad2-...",                             │
    │      device_compliance: "compliant",                        │
    │      join_type: "AzureADJoined",                            │
    │      ... signed with session key (TPM-bound) ...            │
    │    }                                                        │
    ▼                                                              │
  login.microsoftonline.com                                        │
    validates PRT, nonce,                                          │
    device compliance claims ──────────────────────────────────────┘
```

### The PRT cookie contains:

| Claim | Purpose |
|-------|---------|
| `refresh_token` | The PRT itself (proof of user authentication) |
| `request_nonce` | Fresh nonce from server (anti-replay) |
| `iat` | Issued-at timestamp |
| Device ID | Ties to this specific managed device |
| Device compliance | Whether device passes Intune compliance |
| Join type | AzureADJoined, HybridJoined, etc. |
| Session key signature | Proves physical device possession (TPM) |

---

## Why Device Code Flow Failed (Error 530033) <a id="why-device-code-failed"></a>

When we first tried device code flow:

```
1. msx-cli ──► Entra ID: "Give me a device code"
2. Entra ID ──► msx-cli: "Code: GXFH-DKQP, go to microsoft.com/devicelogin"
3. User opens browser, enters code, authenticates
4. Entra ID issues token... BUT:
```

**The problem:** In device code flow, the authentication happens in a browser session at `microsoft.com/devicelogin`. This is a **generic web page** — it doesn't know which device will receive the token. The PRT cookie IS sent during the browser step (you authenticated fine), but Conditional Access evaluates the **requesting device** — which in device code flow is ambiguous.

Microsoft's Conditional Access engine sees:
- ✅ User identity verified
- ✅ MFA completed
- ❌ **Device compliance cannot be verified** — the token will be sent to whatever device has the device_code, which might not be the compliant device

**Error 530033** = "Sign-in was successful but your admin requires the device requesting access to be managed"

### Interactive browser flow fixes this because:

- The browser IS on the managed device
- The PRT cookie proves device compliance cryptographically
- The token is issued directly to the same device (via localhost redirect)
- There's no ambiguity about which device receives the token

---

## Token Caching & Silent Refresh <a id="token-caching"></a>

After initial login:

```
~/.msx-cli/token-cache.json
├── AccessToken (scoped to microsoftsales.crm.dynamics.com, ~1hr lifetime)
├── RefreshToken (long-lived, used to get new access tokens)
├── IdToken (user identity claims)
└── Account (user metadata: UPN, name, tenant)
```

**On subsequent commands** (e.g., `msx-cli milestones`):

1. MSAL calls `acquireTokenSilent()`
2. Checks if access token is still valid (not expired) → uses it directly
3. If expired, uses the **refresh token** to request a new access token from Entra ID
4. This is a server-to-server call — no browser needed
5. Refresh tokens have a longer lifetime (typically 24hrs–90 days depending on tenant policy)
6. If the refresh token also expires, you'll be prompted to `login` again

---

## Security Model <a id="security-model"></a>

| Layer | Protection |
|-------|-----------|
| **Authorization Code** | One-time use, short-lived, tied to redirect URI |
| **PKCE** | Code verifier proves requestor identity, prevents interception |
| **Localhost redirect** | Token never leaves the machine |
| **Random port** | Unpredictable, prevents port pre-binding attacks |
| **PRT** | Device compliance cryptographically proven via TPM-bound key |
| **Nonce** | Prevents PRT cookie replay |
| **Token cache** | Local file, accessible only to current OS user |
| **Refresh token** | Revocable server-side by Entra ID admin |

### What we're NOT doing (and why)

| Rejected approach | Risk |
|-------------------|------|
| Cookie extraction (DPAPI) | Offensive security technique, triggers EDR alerts |
| ROPC (username/password) | Blocked by MFA, deprecated |
| Device code flow | Can't carry device compliance claims |
| Custom app registration | Blocked by admin policy |

---

## References

- [RFC 8252 — OAuth 2.0 for Native Apps](https://datatracker.ietf.org/doc/html/rfc8252) (especially Section 7.3 on loopback)
- [Microsoft Entra ID: Primary Refresh Token](https://learn.microsoft.com/en-us/entra/identity/devices/concept-primary-refresh-token)
- [MSAL Node: Acquiring Tokens](https://learn.microsoft.com/en-us/entra/msal/javascript/node/acquire-token-requests)
- [Redirect URI restrictions](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url)
- [Conditional Access: Authentication flows](https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-authentication-flows)
- [Commonly used Microsoft first-party app IDs](https://learn.microsoft.com/en-us/power-platform/admin/apps-to-allow)
