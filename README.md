# msx-cli

> **AI-powered CLI for Microsoft Dynamics 365 (MSX)** — manage opportunities, milestones, and earnings from your terminal.

---

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/MoimHossain/msx-cli.git
cd msx-cli
npm install

# 2. Build
npm run build

# 3. Sign in (opens your browser — no app registration needed)
npx msx-cli login

# 4. Start using it
npx msx-cli milestone list
npx msx-cli opportunity list --active
npx msx-cli earnings --year 2026
```

---

## How to Use

### For Sellers / Account Managers

Check your pipeline, track milestones, and review earnings — all without leaving the terminal.

```bash
# See your active milestones
msx-cli milestone list

# Filter milestones by status
msx-cli milestone list --status OnTrack

# View details of a specific milestone
msx-cli milestone get 12345-67890

# Check your earnings for 2026
msx-cli earnings --year 2026

# List active opportunities
msx-cli opportunity list --active

# Search opportunities by name
msx-cli opportunity search "Contoso"
```

### For Managers / Leaders

Look up any team member's milestones or earnings by email.

```bash
# Query milestones for a team member
msx-cli milestone query --user john.doe@microsoft.com

# Check a team member's earnings
msx-cli earnings --user john.doe@microsoft.com --year 2026

# Filter milestones by date range
msx-cli milestone query --after 2026-01-01 --before 2026-06-30
```

### For Developers / Power Users

Explore CRM schema, query any entity, and integrate into scripts.

```bash
# Explore the milestone schema
msx-cli milestone show-schema

# See all valid milestone status values
msx-cli milestone show-statuses

# Query any CRM entity with raw OData
msx-cli query accounts -q "\$select=name,revenue&\$top=5"

# Edit a milestone
msx-cli milestone edit 12345-67890 msp_name="Updated Name"

# Edit an opportunity
msx-cli opportunity edit <guid> estimatedvalue=500000

# Use custom field selection
msx-cli milestone list --fields msp_milestonenumber,msp_name,msp_milestonedate
```

### For AI Agent Authors

`msx-cli` is designed to work as a **tool/skill** inside AI agents (GitHub Copilot, Claude, etc.). Every command produces structured terminal output that agents can parse, and the CLI handles authentication and token refresh transparently.

```bash
# AI agents can call any command — examples:
msx-cli milestone list --status "At Risk"
msx-cli opportunity search "Enterprise"
msx-cli earnings --year 2026
msx-cli query opportunities -q "\$filter=statecode eq 0&\$top=10"
```

---

## Table of Contents

- [Quick Start](#quick-start)
- [How to Use](#how-to-use)
- [Installation](#installation)
- [Authentication](#authentication)
- [Command Reference](#command-reference)
  - [Authentication Commands](#authentication-commands)
  - [Milestone Commands](#milestone-commands)
  - [Opportunity Commands](#opportunity-commands)
  - [Earnings](#earnings)
  - [Generic Query](#generic-query)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Further Reading](#further-reading)
- [License](#license)

---

## Installation

### Prerequisites

- **Node.js** 22 or later
- **npm** (comes with Node.js)
- A **Windows device** joined to Azure AD (for Conditional Access / device compliance)
- Access to the Microsoft Sales Dynamics 365 instance (`microsoftsales.crm.dynamics.com`)

### Install from source

```bash
git clone https://github.com/MoimHossain/msx-cli.git
cd msx-cli
npm install
npm run build
```

### Run after building

```bash
# Via npx (recommended)
npx msx-cli <command>

# Or directly
node dist/index.js <command>
```

### During development

```bash
# Uses tsx for live TypeScript execution
npm run dev -- <command>
# or
npx tsx src/index.ts <command>
```

---

## Authentication

### How it works

`msx-cli` uses **OAuth 2.0 Authorization Code flow with PKCE**, routed through your **system browser** (Edge). This approach:

- **Requires no custom app registration** — uses Microsoft's well-known first-party client ID for Dynamics 365 (`2ad88395-b77d-4561-9441-d0e40824f9bc`), the same one used by XrmToolBox, Power Platform CLI, and Dataverse ServiceClient.
- **Satisfies device compliance** — your system browser carries the device's Primary Refresh Token (PRT), passing Conditional Access checks automatically.
- **Supports MFA** — handled natively by the browser's existing session.

### Login flow

```bash
msx-cli login
# 🌐 Opening your browser for sign-in...
#    (Your device compliance claims will be included automatically)
# ✅ Signed in as john.doe@microsoft.com
#    Token cached for future sessions.
```

After the first login, tokens are cached at `~/.msx-cli/token-cache.json`. Subsequent commands use **silent token renewal** — no browser prompt until the refresh token expires.

### Sign out

```bash
msx-cli logout
# ✅ Signed out. Token cache cleared.
```

### Check current session

```bash
msx-cli whoami
# 👤 John Doe (john.doe@microsoft.com)
```

> **Deep dive:** See [docs/auth-deep-dive.md](docs/auth-deep-dive.md) for a full technical walkthrough of the authentication flow, PRT, PKCE, and why device code flow doesn't work in compliant-device environments.

---

## Command Reference

### Top-level help

```bash
msx-cli --help
```

```
Usage: msx-cli [options] [command]

AI-powered CLI for Microsoft Dynamics 365 (MSX)

Options:
  -V, --version             output the version number
  -h, --help                display help for command

Commands:
  login                     Sign in to MSX via browser (device-compliant)
  logout                    Sign out and clear cached tokens
  whoami                    Show current signed-in account
  milestone                 Manage MSX milestones (msp_engagementmilestones)
  opportunity|oppty         Manage opportunities
  earnings [options]        View earnings from won opportunities
  query [options] <entity>  Query any CRM entity (for exploration)
  help [command]            display help for command
```

---

### Authentication Commands

| Command | Description |
|---------|-------------|
| `msx-cli login` | Sign in via browser (opens system browser, device-compliant) |
| `msx-cli logout` | Sign out and clear cached tokens |
| `msx-cli whoami` | Show the currently signed-in account |

---

### Milestone Commands

Milestones map to the `msp_engagementmilestones` entity in Dynamics 365.

#### `milestone list`

List your active milestones.

```bash
msx-cli milestone list
msx-cli milestone list --top 10
msx-cli milestone list --all                  # include inactive
msx-cli milestone list --status Completed
msx-cli milestone list --fields msp_milestonenumber,msp_name,msp_milestonedate
```

| Option | Description |
|--------|-------------|
| `-n, --top <number>` | Max results (default: 50) |
| `--all` | Include inactive milestones |
| `--status <status>` | Filter by status label (e.g. `Completed`, `OnTrack`) |
| `--fields <fields>` | Comma-separated fields to display |

#### `milestone get <id>`

Get full details of a milestone by milestone number (e.g. `12345-67890`) or GUID.

```bash
msx-cli milestone get 12345-67890
msx-cli milestone get a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

#### `milestone query`

Query milestones with rich filtering.

```bash
msx-cli milestone query --user alice@microsoft.com
msx-cli milestone query --name "Cloud Migration"
msx-cli milestone query --status OnTrack --after 2026-01-01
msx-cli milestone query --before 2026-06-30 --top 20
```

| Option | Description |
|--------|-------------|
| `-u, --user <email>` | Filter by user email address |
| `-s, --name <name>` | Filter by milestone name (partial match) |
| `--status <status>` | Filter by status label |
| `--before <date>` | Milestone date before (YYYY-MM-DD) |
| `--after <date>` | Milestone date after (YYYY-MM-DD) |
| `--all` | Include inactive milestones |
| `-n, --top <number>` | Max results (default: 50) |
| `--fields <fields>` | Comma-separated fields to display |

#### `milestone edit <id>`

Update a milestone's fields. Accepts `field=value` pairs.

```bash
msx-cli milestone edit 12345-67890 msp_name="Updated Milestone Name"
msx-cli milestone edit 12345-67890 msp_milestonedate=2026-09-15 msp_name="Q3 Deployment"
```

#### `milestone add`

Create a new milestone.

```bash
msx-cli milestone add --name "Q4 Customer Onboarding"
msx-cli milestone add --name "Azure Migration" --date 2026-12-01
```

| Option | Description |
|--------|-------------|
| `--name <name>` | **(required)** Milestone name |
| `--date <date>` | Milestone date (YYYY-MM-DD) |

#### `milestone show-schema`

Explore all available fields on the milestone entity.

```bash
msx-cli milestone show-schema
msx-cli milestone show-schema --filter status
```

#### `milestone show-statuses`

List all valid milestone status values (picklist options).

```bash
msx-cli milestone show-statuses
```

---

### Opportunity Commands

The `opportunity` command (alias: `oppty`) manages the `opportunities` entity.

#### `opportunity list`

```bash
msx-cli opportunity list
msx-cli opportunity list --active --top 10
msx-cli opportunity list --fields name,estimatedvalue,stepname
```

| Option | Description |
|--------|-------------|
| `-a, --active` | Active only |
| `-n, --top <number>` | Max results (default: 20) |
| `--fields <fields>` | Comma-separated fields to display |

#### `opportunity get <id>`

Get full details of an opportunity by GUID.

```bash
msx-cli opportunity get a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

#### `opportunity search <term>`

Search opportunities by name.

```bash
msx-cli opportunity search "Contoso"
msx-cli opportunity search "Enterprise" --top 5
```

| Option | Description |
|--------|-------------|
| `-n, --top <number>` | Max results (default: 20) |
| `--fields <fields>` | Comma-separated fields to display |

#### `opportunity edit <id>`

Update an opportunity's fields.

```bash
msx-cli opportunity edit <guid> name="New Deal Name" estimatedvalue=500000
```

#### `opportunity show-schema`

Explore all available fields on the opportunity entity.

```bash
msx-cli opportunity show-schema
msx-cli opportunity show-schema --filter budget
```

---

### Earnings

View your (or a team member's) earnings from won opportunities.

```bash
msx-cli earnings
msx-cli earnings --year 2026
msx-cli earnings --user john.doe@microsoft.com
msx-cli earnings --user john.doe@microsoft.com --year 2026
```

| Option | Description |
|--------|-------------|
| `-y, --year <year>` | Filter by year (e.g. 2026) |
| `-u, --user <email>` | Filter by user email (default: you) |

**Example output:**

```
💰 Earnings (in 2026)
   Total: $1,234,567
   Won opportunities: 8

┌──────────────────────────────────┬──────────────┬────────────┬──────────────────────────┐
│ Name                             │ Actual Value │ Close Date │ Account                  │
├──────────────────────────────────┼──────────────┼────────────┼──────────────────────────┤
│ Contoso Enterprise Renewal       │ $450,000     │ 2026-03-15 │ Contoso Ltd              │
│ Fabrikam Cloud Migration         │ $320,000     │ 2026-02-28 │ Fabrikam Inc             │
└──────────────────────────────────┴──────────────┴────────────┴──────────────────────────┘
```

---

### Generic Query

Query **any** CRM entity for exploration and advanced use cases.

```bash
msx-cli query <entity> [options]
```

```bash
# Query accounts
msx-cli query accounts

# With OData query string
msx-cli query accounts -q "\$select=name,revenue&\$filter=revenue gt 1000000&\$top=5"

# Query contacts
msx-cli query contacts -n 10

# Query any custom entity
msx-cli query msp_engagements -q "\$top=3"
```

| Option | Description |
|--------|-------------|
| `-q, --odata <query>` | OData query string |
| `-n, --top <number>` | Number of results (default: 5) |

---

## Architecture

```
msx-cli/
├── src/
│   ├── index.ts          # CLI entry point — registers all commands
│   ├── auth.ts           # MSAL authentication (interactive browser + token cache)
│   ├── api.ts            # Dynamics 365 Web API client (OData v4)
│   ├── banner.ts         # ASCII banner and version display
│   ├── config.ts         # CRM endpoint configuration and API URL builder
│   ├── helpers.ts        # Formatters, table builders, and utility functions
│   └── commands/
│       ├── auth.ts       # login, logout, whoami commands
│       ├── milestone.ts  # milestone list/get/query/edit/add/show-schema/show-statuses
│       ├── opportunity.ts # opportunity list/get/search/edit/show-schema
│       ├── earnings.ts   # earnings command
│       └── query.ts      # generic entity query
├── docs/
│   ├── commands.md       # Full command reference
│   ├── auth-deep-dive.md # Authentication deep dive (PRT, PKCE, etc.)
│   ├── blog.md           # Blog post about building this CLI
│   └── plan.md           # Original project plan and auth research
├── package.json
├── tsconfig.json
└── LICENSE               # MIT
```

### Key design decisions

| Decision | Rationale |
|----------|-----------|
| **TypeScript** | Type safety for complex CRM entity shapes and OData annotations |
| **Commander.js** | Mature CLI framework with subcommands, options, and help generation |
| **MSAL Node** | Microsoft's official auth library with built-in token caching and silent renewal |
| **First-party client ID** | No custom app registration needed — works out of the box |
| **Interactive browser flow** | Satisfies Conditional Access (device compliance via PRT) |
| **OData annotations** | Leverages `@OData.Community.Display.V1.FormattedValue` for human-readable display values |

### How the API client works

All CRM interactions go through `src/api.ts` which provides:

- **`crmFetch<T>()`** — GET requests for entity collections (OData `$select`, `$filter`, `$top`, `$orderby`)
- **`crmFetchSingle<T>()`** — GET requests for a single entity by ID
- **`crmPatch()`** — PATCH requests to update entity records
- **`crmPost<T>()`** — POST requests to create new records
- **Entity metadata** — `getEntitySchema()` and `getPicklistOptions()` to explore CRM schema at runtime

Every request automatically acquires a fresh access token (or uses a cached one) via `getToken()` from `src/auth.ts`.

---

## Configuration

### CRM Endpoint

The CRM target is configured in `src/config.ts`:

```typescript
export const MSX_CONFIG = {
  clientId: "2ad88395-b77d-4561-9441-d0e40824f9bc",  // Well-known Dynamics 365 client ID
  authority: "https://login.microsoftonline.com/organizations",
  crmBaseUrl: "https://microsoftsales.crm.dynamics.com",
  apiPath: "/api/data/v9.2",
  scopes: ["https://microsoftsales.crm.dynamics.com/.default"],
};
```

### Token cache

Tokens are stored at `~/.msx-cli/token-cache.json`. This file is created automatically on first `login` and removed on `logout`.

---

## Development

### Build

```bash
npm run build        # Compile TypeScript → dist/
```

### Dev mode

```bash
npm run dev -- <command>     # Run directly with tsx (no build step)
```

### Project scripts

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `tsc` | Compile TypeScript to JavaScript |
| `dev` | `tsx src/index.ts` | Run in development mode |
| `start` | `node dist/index.js` | Run the compiled CLI |

### Dependencies

| Package | Purpose |
|---------|---------|
| `@azure/msal-node` | Microsoft Authentication Library for OAuth 2.0 |
| `commander` | CLI framework (commands, options, help) |
| `chalk` | Terminal colors and styling |
| `cli-table3` | Formatted tables in the terminal |
| `ora` | Spinner animations for loading states |

### Dev dependencies

| Package | Purpose |
|---------|---------|
| `typescript` | TypeScript compiler |
| `tsx` | TypeScript execution for development |
| `@types/node` | Node.js type definitions |

---

## Troubleshooting

### "Not logged in. Run `msx-cli login` first."

You need to authenticate before running any data commands. Run:

```bash
msx-cli login
```

### "Session expired. Re-authenticating..."

Your refresh token has expired. The CLI will automatically open the browser for re-authentication. This is normal after extended inactivity.

### Error 530033: "Your admin requires the device requesting access to be managed"

This means you're trying to authenticate from a device that isn't Azure AD joined or Intune compliant. The CLI must be run from a **managed Windows device** with device compliance.

### Browser doesn't open

The CLI uses `start "" "<url>"` to open the system browser on Windows. If this fails, ensure your default browser is set correctly. On non-Windows platforms, you may need to adjust the browser-open mechanism in `src/auth.ts`.

### Token cache issues

If you encounter stale token errors, clear the cache manually:

```bash
msx-cli logout
# or manually delete:
rm -rf ~/.msx-cli/
```

---

## Further Reading

- [Command Reference (detailed)](docs/commands.md) — full documentation of every command and option
- [Authentication Deep Dive](docs/auth-deep-dive.md) — how PRT, PKCE, and device compliance work
- [Blog Post](docs/blog.md) — the story of building this CLI and turning it into an AI agent skill
- [Project Plan](docs/plan.md) — original design, auth research, and trade-off analysis

### External references

- [Dynamics 365 Web API](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/overview) — OData v4 API documentation
- [MSAL Node](https://learn.microsoft.com/en-us/entra/msal/javascript/node/) — Microsoft Authentication Library for Node.js
- [First-party app IDs](https://learn.microsoft.com/en-us/power-platform/admin/apps-to-allow) — well-known Microsoft client IDs
- [Primary Refresh Token](https://learn.microsoft.com/en-us/entra/identity/devices/concept-primary-refresh-token) — device compliance via PRT
- [RFC 8252](https://datatracker.ietf.org/doc/html/rfc8252) — OAuth 2.0 for Native Apps

---

## License

[MIT](LICENSE) © Moim HA
