# MSX CLI — AI-Powered Dynamics 365 Assistant

## Problem Statement

Build a CLI app (`msx-cli`) that uses **GitHub Copilot SDK** as an AI backend to interact with **MSX (Microsoft Dynamics 365 CRM)** at `microsoftsales.crm.dynamics.com`. The app should read opportunities, milestones, make changes, and provide AI-driven insights.

**Core constraint:** Dynamics admin will NOT allow custom app registrations in Azure AD. We must find alternative authentication strategies that work within this restriction.

## Proposed Approach

A **Node.js/TypeScript CLI** using:
- `@github/copilot-sdk` for AI reasoning, natural language query → OData translation, insights
- Dynamics 365 Web API (OData v4) at `https://microsoftsales.crm.dynamics.com/api/data/v9.2/`
- One of the authentication strategies below (to be selected)

---

## Authentication Strategy Research & Trade-offs

### Option A: Well-Known Dynamics 365 Client ID + Device Code Flow ⭐ RECOMMENDED

Microsoft provides a **first-party, pre-registered** client ID for Dynamics 365:
- **Client ID:** `2ad88395-b77d-4561-9441-d0e40824f9bc`
- **Redirect URI:** `app://5d3e90d6-aa8e-48a8-8f2c-58b45cc67315`

This is the same ID used by XrmToolBox, Power Platform CLI (`pac`), and Dataverse ServiceClient. It is a **multi-tenant first-party app** — already registered by Microsoft, allowed by default in most tenants.

**How it works:**
1. CLI starts → initiates device code flow with the well-known client ID
2. User sees: `To sign in, use a web browser to open https://microsoft.com/devicelogin and enter code ABCD-EFGH`
3. User opens browser, enters code, authenticates with MFA/SSO as normal
4. CLI receives `access_token` + `refresh_token` for `microsoftsales.crm.dynamics.com`
5. Tokens cached locally (encrypted), refresh token used for subsequent sessions

**User Experience:**
```
$ msx-cli login
🔐 To sign in, open https://microsoft.com/devicelogin
   and enter code: GXFH-DKQP

   Waiting for authentication...
✅ Signed in as moi.hossain@microsoft.com
   Token cached for future sessions.

$ msx-cli opportunities
🤖 AI: Found 12 active opportunities. Here's a summary:
   1. Contoso Enterprise Deal — $2.4M — Stage: Propose
   ...
```

| Aspect | Rating |
|--------|--------|
| **No app registration needed** | ✅ Yes — uses Microsoft's first-party app |
| **MFA compatible** | ✅ Full MFA + Conditional Access support |
| **Security** | ✅ Official OAuth 2.0 flow, device-bound tokens |
| **Token refresh** | ✅ Refresh tokens supported, long-lived sessions |
| **UX smoothness** | ⭐⭐⭐⭐ One-time browser auth, then seamless CLI |
| **Offline/headless** | ✅ After initial auth, works without browser |
| **Admin concern risk** | ⚠️ Low — this client ID is listed as "always allowed" by Microsoft |
| **Complexity** | Low — standard MSAL library usage |

**Risks:**
- Some tenants may have explicitly restricted which client IDs can access Dataverse. The well-known ID is typically allowed by default but an admin *could* block it.
- Requires one-time interactive browser sign-in per device.

---

### Option B: Azure CLI Piggyback (az account get-access-token)

Use Azure CLI's own first-party client ID (`04b07795-8ddb-461a-bbee-02f9e1bf7b46`) as a token broker.

**How it works:**
1. User runs `az login` (one-time, likely already done)
2. CLI invokes `az account get-access-token --resource https://microsoftsales.crm.dynamics.com`
3. Azure CLI returns a fresh access token for the CRM endpoint
4. CLI uses this token for API calls

**User Experience:**
```
$ az login  # one-time, or already done
$ msx-cli opportunities
🔄 Acquiring token via Azure CLI...
🤖 AI: Found 12 active opportunities...
```

| Aspect | Rating |
|--------|--------|
| **No app registration needed** | ✅ Yes — piggybacks on az CLI's app |
| **MFA compatible** | ✅ Yes (az login handles it) |
| **Security** | ✅ Good — leverages existing az session |
| **Token refresh** | ⚠️ Depends on az CLI session validity |
| **UX smoothness** | ⭐⭐⭐ Requires az CLI pre-installed + logged in |
| **Offline/headless** | ⚠️ Needs az CLI on PATH |
| **Admin concern risk** | ⚠️ Medium — az CLI may not have CRM scopes granted in all tenants |
| **Complexity** | Low — shell-out to az CLI |

**Risks:**
- Azure CLI's client ID may not have consent/scope for Dynamics 365 in your tenant.
- Adds a hard dependency on Azure CLI being installed and authenticated.
- Token may not include the CRM audience if not explicitly consented.

---

### Option C: Playwright Browser Automation (Edge Profile Reuse)

Use Playwright to launch a browser with your real Edge profile, navigate to CRM, and intercept the OAuth token from network requests or localStorage.

**How it works:**
1. CLI launches Playwright with `--user-data-dir` pointing to your Edge profile
2. Navigates to `https://microsoftsales.crm.dynamics.com`
3. Your existing session cookies handle SSO — no login prompt
4. Intercepts `Authorization: Bearer <token>` from network requests
5. Extracts the token and uses it for subsequent API calls

**User Experience:**
```
$ msx-cli login --browser
🌐 Launching Edge with your profile...
   (A browser window briefly appears and closes)
✅ Token acquired from your active MSX session.

$ msx-cli opportunities
🤖 AI: Found 12 active opportunities...
```

| Aspect | Rating |
|--------|--------|
| **No app registration needed** | ✅ Yes — reuses browser session |
| **MFA compatible** | ✅ Already completed in browser |
| **Security** | ⚠️ Mixed — accesses browser profile directly |
| **Token refresh** | ❌ Token expires in ~1hr, need re-launch |
| **UX smoothness** | ⭐⭐ Browser flashes open, requires Edge closed |
| **Offline/headless** | ❌ Needs display/browser |
| **Admin concern risk** | ⚠️ Medium — no policy violation, but unconventional |
| **Complexity** | High — Playwright dep, profile locking, timing |

**Risks:**
- **Profile locking**: Only one process can use an Edge profile at a time. User must close Edge or use a profile copy.
- Tokens expire (~1 hour) and there's no refresh token — must re-launch browser.
- Fragile — CRM UI changes can break token extraction.
- Large dependency (Playwright + Chromium binaries).

---

### Option D: ROPC (Username + Password) with Well-Known Client ID

Use the Resource Owner Password Credentials flow directly with user's email and password.

**How it works:**
1. CLI prompts for username and password
2. Sends `grant_type=password` to `login.microsoftonline.com` with the well-known client ID
3. Gets back an access token

**User Experience:**
```
$ msx-cli login
📧 Username: john.doe@microsoft.com
🔑 Password: ********
✅ Signed in successfully.
```

| Aspect | Rating |
|--------|--------|
| **No app registration needed** | ✅ Yes — uses well-known client ID |
| **MFA compatible** | ❌ NO — fails with MFA enabled |
| **Security** | ❌ Poor — credentials sent in plaintext to endpoint |
| **Token refresh** | ✅ Refresh tokens available |
| **UX smoothness** | ⭐⭐⭐⭐⭐ Simplest UX |
| **Offline/headless** | ✅ Fully headless |
| **Admin concern risk** | 🔴 High — deprecated by Microsoft, blocked in secure tenants |
| **Complexity** | Lowest |

**Risks:**
- **Almost certainly blocked** in Microsoft's corporate tenant (MFA is enforced).
- Microsoft is actively deprecating ROPC.
- Not viable for most enterprise scenarios.

---

### Option E: Edge Cookie/Token Extraction (DPAPI Decryption)

Read Edge's cookie database directly and decrypt tokens using Windows DPAPI.

| Aspect | Rating |
|--------|--------|
| **No app registration needed** | ✅ |
| **MFA compatible** | ✅ (cookies from completed MFA session) |
| **Security** | 🔴 Terrible — essentially credential theft technique |
| **Token refresh** | ❌ Cookies may not contain refresh tokens |
| **UX smoothness** | ⭐⭐⭐⭐ Silent, no user interaction |
| **Admin concern risk** | 🔴 Very high — looks like malware to security tools |
| **Complexity** | High — DPAPI, AES-GCM, SQLite parsing |

**Verdict:** ❌ **Do not pursue.** This is an offensive security technique, will trigger endpoint protection alerts, and is ethically questionable for a productivity tool.

---

## Recommendation Matrix

| Approach | No App Reg | MFA | Security | UX | Viability |
|----------|-----------|-----|----------|----|-----------|
| **A: Device Code + Well-Known ID** | ✅ | ✅ | ✅ | ⭐⭐⭐⭐ | **✅ Best** |
| B: Azure CLI Piggyback | ✅ | ✅ | ✅ | ⭐⭐⭐ | ⚠️ Maybe |
| C: Playwright Browser | ✅ | ✅ | ⚠️ | ⭐⭐ | ⚠️ Fragile |
| D: ROPC | ✅ | ❌ | ❌ | ⭐⭐⭐⭐⭐ | ❌ Blocked |
| E: Cookie Extraction | ✅ | ✅ | 🔴 | ⭐⭐⭐⭐ | ❌ No |

**Primary recommendation: Option A** with **Option B as fallback**.

---

## Implementation Plan (Using Option A as Primary)

### Phase 1: Project Scaffolding
- Initialize Node.js/TypeScript project with `package.json`, `tsconfig.json`
- Set up CLI framework (e.g., `commander` or `yargs`)
- Configure build pipeline (`tsx` for dev, `tsc` for production)

### Phase 2: Authentication Module
- Implement device code flow using `@azure/msal-node` with the well-known Dynamics 365 client ID
- Token caching (MSAL's built-in file-based cache or encrypted local storage)
- Refresh token management for seamless re-authentication
- `msx-cli login` and `msx-cli logout` commands

### Phase 3: Dynamics 365 API Client
- HTTP client wrapper for Dynamics 365 Web API (OData v4)
- Entity query builders for: `opportunities`, `accounts`, `contacts`, custom entities
- Support for `$select`, `$filter`, `$expand`, `$orderby`, `$top`
- CRUD operations (GET, POST, PATCH, DELETE)

### Phase 4: GitHub Copilot SDK Integration
- Integrate `@github/copilot-sdk` as the AI reasoning engine
- Register "tools" that the AI can call:
  - `list_opportunities` — query and summarize opportunities
  - `get_opportunity_details` — deep dive into a single opportunity
  - `update_opportunity` — modify fields
  - `search_accounts` — find accounts/contacts
  - `get_insights` — pipeline analysis, win/loss trends
- Natural language → structured API call translation

### Phase 5: CLI Commands & UX
- `msx-cli login` — device code auth flow
- `msx-cli chat` — interactive AI chat mode
- `msx-cli opportunities [list|get|update]` — direct commands
- `msx-cli insights` — AI-generated pipeline insights
- Rich terminal output (tables, colors, spinners)

### Phase 6: Polish & Distribution
- Error handling, retry logic, rate limiting
- Configuration file (`~/.msx-cli/config.json`)
- README and usage documentation
- npm packaging

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 22+ / TypeScript 5.x |
| CLI Framework | `commander` |
| Auth | `@azure/msal-node` (device code flow) |
| AI | `@github/copilot-sdk` |
| HTTP | `node-fetch` or built-in `fetch` |
| Output | `chalk`, `ora`, `cli-table3` |
| Config | `conf` (encrypted local storage) |

## Key Decisions Pending

1. **Confirm Option A viability:** Should we first do a quick spike to verify the well-known client ID works against `microsoftsales.crm.dynamics.com` in your tenant?
2. **Fallback strategy:** Should we implement Option B (az CLI) as a secondary auth method?
3. **Scope of CRM operations:** Which entities beyond opportunities are priority? (accounts, contacts, leads, custom entities?)
