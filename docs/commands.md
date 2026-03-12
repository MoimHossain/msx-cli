# MSX CLI — Command Reference

A command-line interface for interacting with Microsoft Dynamics 365 (MSX / microsoftsales.crm.dynamics.com). Manage milestones, opportunities, earnings, and explore CRM entities — all from your terminal.

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication](#authentication)
  - [login](#login)
  - [logout](#logout)
  - [whoami](#whoami)
- [Milestones](#milestones)
  - [milestone list](#milestone-list)
  - [milestone get](#milestone-get)
  - [milestone query](#milestone-query)
  - [milestone edit](#milestone-edit)
  - [milestone add](#milestone-add)
  - [milestone show-schema](#milestone-show-schema)
  - [milestone show-statuses](#milestone-show-statuses)
- [Opportunities](#opportunities)
  - [opportunity list](#opportunity-list)
  - [opportunity get](#opportunity-get)
  - [opportunity search](#opportunity-search)
  - [opportunity edit](#opportunity-edit)
  - [opportunity show-schema](#opportunity-show-schema)
- [Earnings](#earnings)
- [Generic Query](#generic-query)
- [Tips & Tricks](#tips--tricks)

---

## Getting Started

```bash
# Build the CLI
npm run build

# Run any command
npx msx-cli <command> [options]

# Or during development
npx tsx src/index.ts <command> [options]

# Show all available commands
msx-cli --help
```

**Top-level help output:**

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

## Authentication

The CLI authenticates via MSAL interactive browser flow. Your default system browser (Edge) opens to the Microsoft login page. Because it uses your existing browser profile with device compliance (PRT), it satisfies Conditional Access policies without needing a custom app registration.

> **Note:** Tokens are cached locally. After the first `login`, subsequent commands use silent token renewal — no browser prompt needed until the refresh token expires.

For a deep-dive on how authentication works under the hood, see [docs/auth-deep-dive.md](auth-deep-dive.md).

### login

Sign in to MSX. Opens your system browser for interactive authentication.

```bash
msx-cli login
```

**Expected output:**

```
✅ Signed in as john.doe@microsoft.com
   Token cached for future sessions.
```

### logout

Clear cached tokens and sign out.

```bash
msx-cli logout
```

**Expected output:**

```
✅ Signed out. Token cache cleared.
```

### whoami

Show the currently signed-in account.

```bash
msx-cli whoami
```

**Expected output (signed in):**

```
👤 John Doe (john.doe@microsoft.com)
```

**Expected output (not signed in):**

```
⚠️  Not signed in. Run `msx-cli login` first.
```

---

## Milestones

Manage MSX engagement milestones (`msp_engagementmilestones` entity). Milestone numbers use the format `7-XXXXXXXXX`.

### milestone list

List milestones assigned to you.

```bash
msx-cli milestone list [options]
```

| Option | Description | Default |
|---|---|---|
| `-n, --top <number>` | Maximum results to return | `50` |
| `--all` | Include inactive milestones | `false` |
| `--status <status>` | Filter by status label (e.g. `Completed`, `OnTrack`) | — |
| `--fields <fields>` | Comma-separated fields to display (custom columns) | — |

**Example — list your active milestones:**

```bash
msx-cli milestone list
```

```
🏁 My Milestones (3 results)
┌────────────────┬────────────────────────────┬────────────────┬────────────┬────────────────────────┬────────────────┐
│ Milestone #    │ Name                       │ Status         │ Date       │ Account                │ Area           │
├────────────────┼────────────────────────────┼────────────────┼────────────┼────────────────────────┼────────────────┤
│ 7-501234567    │ Azure Migration Phase 1    │ On Track       │ 2026-06-15 │ Contoso Ltd            │ Azure          │
├────────────────┼────────────────────────────┼────────────────┼────────────┼────────────────────────┼────────────────┤
│ 7-501234568    │ Teams Rollout Planning     │ At Risk        │ 2026-07-01 │ Fabrikam Inc           │ Modern Work    │
├────────────────┼────────────────────────────┼────────────────┼────────────┼────────────────────────┼────────────────┤
│ 7-501234569    │ Security Assessment        │ Completed      │ 2026-04-30 │ Northwind Traders      │ Security       │
└────────────────┴────────────────────────────┴────────────────┴────────────┴────────────────────────┴────────────────┘
```

**Example — filter by status:**

```bash
msx-cli milestone list --status "On Track"
```

```
🏁 My Milestones (status: On Track) (1 results)
┌────────────────┬────────────────────────────┬────────────────┬────────────┬────────────────────────┬────────────────┐
│ Milestone #    │ Name                       │ Status         │ Date       │ Account                │ Area           │
├────────────────┼────────────────────────────┼────────────────┼────────────┼────────────────────────┼────────────────┤
│ 7-501234567    │ Azure Migration Phase 1    │ On Track       │ 2026-06-15 │ Contoso Ltd            │ Azure          │
└────────────────┴────────────────────────────┴────────────────┴────────────┴────────────────────────┴────────────────┘
```

**Example — custom field columns:**

```bash
msx-cli milestone list --fields "msp_milestonenumber,msp_name,msp_milestonestatus"
```

```
🏁 My Milestones (3 results)
┌───────────────────────┬──────────────────────┬───────────────────────┐
│ msp_milestonenumber   │ msp_name             │ msp_milestonestatus   │
├───────────────────────┼──────────────────────┼───────────────────────┤
│ 7-501234567           │ Azure Migration      │ On Track              │
│                       │ Phase 1              │                       │
├───────────────────────┼──────────────────────┼───────────────────────┤
│ 7-501234568           │ Teams Rollout        │ At Risk               │
│                       │ Planning             │                       │
└───────────────────────┴──────────────────────┴───────────────────────┘
```

### milestone get

Get full details of a single milestone. Accepts either a milestone number (e.g. `7-501234567`) or a GUID.

```bash
msx-cli milestone get <id>
```

**Example:**

```bash
msx-cli milestone get 7-501234567
```

```
🏁 Milestone Details
Milestone #:    7-501234567
Name:           Azure Migration Phase 1
GUID:           a1b2c3d4-e5f6-7890-abcd-ef1234567890
Status:         On Track
Status Reason:  —
Category:       Deployment
Workload:       Azure IaaS
Solution Area:  Azure
Milestone Date: 2026-06-15
Completed:      No
Completed On:   —
Commitment:     High
Help Needed:    —
Account:        Contoso Ltd
Area:           Azure
Entity:         Contoso Corp
Owner:          John Doe
Activations:    5
Seats:          200
BACV:           150000
Est. Monthly:   $12,500
Comments:       Migration on schedule, phase 2 planning underway
Risk/Blockers:  Pending network configuration approval
Created:        2026-01-15
Modified:       2026-03-10
```

### milestone query

Query milestones with flexible filters. Unlike `list` (which only shows your milestones), `query` can find milestones owned by any user.

```bash
msx-cli milestone query [options]
```

| Option | Description | Default |
|---|---|---|
| `-u, --user <email>` | Filter by owner's email address | — |
| `-s, --name <name>` | Filter by milestone name (partial match) | — |
| `--status <status>` | Filter by status label | — |
| `--before <date>` | Milestone date before (YYYY-MM-DD) | — |
| `--after <date>` | Milestone date after (YYYY-MM-DD) | — |
| `--all` | Include inactive milestones | `false` |
| `-n, --top <number>` | Maximum results | `50` |
| `--fields <fields>` | Comma-separated fields to display | — |

**Example — find milestones for a specific user:**

```bash
msx-cli milestone query --user jane.smith@microsoft.com
```

```
🔍 Found 5 milestones for jane.smith@microsoft.com
┌────────────────┬────────────────────────────┬────────────────┬────────────┬────────────────────────┬────────────────┐
│ Milestone #    │ Name                       │ Status         │ Date       │ Account                │ Area           │
├────────────────┼────────────────────────────┼────────────────┼────────────┼────────────────────────┼────────────────┤
│ 7-509876543    │ Copilot Enablement         │ On Track       │ 2026-08-01 │ Adventure Works        │ Modern Work    │
│ ...            │ ...                        │ ...            │ ...        │ ...                    │ ...            │
└────────────────┴────────────────────────────┴────────────────┴────────────┴────────────────────────┴────────────────┘
```

**Example — combine filters:**

```bash
msx-cli milestone query --status "At Risk" --after 2026-01-01 --before 2026-12-31
```

**Example — search by name:**

```bash
msx-cli milestone query --name "Azure"
```

### milestone edit

Update fields on an existing milestone. Pass field=value pairs. Accepts milestone number or GUID.

```bash
msx-cli milestone edit <id> <field=value...>
```

**Example:**

```bash
msx-cli milestone edit 7-501234567 msp_name="Azure Migration Phase 1 - Updated" msp_forecastcomments="Revised timeline"
```

```
✔ Milestone updated.

Milestone #:    7-501234567
Name:           Azure Migration Phase 1 - Updated
...
Comments:       Revised timeline
```

> **Tip:** Use `milestone show-schema` to discover valid field names and which ones are editable.

### milestone add

Create a new milestone.

```bash
msx-cli milestone add --name <name> [--date <YYYY-MM-DD>]
```

| Option | Description | Required |
|---|---|---|
| `--name <name>` | Milestone name | ✅ Yes |
| `--date <date>` | Milestone date (YYYY-MM-DD) | No |

**Example:**

```bash
msx-cli milestone add --name "Copilot Adoption Workshop" --date 2026-09-15
```

```
✔ Milestone created.

Milestone #:    7-505551234
Name:           Copilot Adoption Workshop
GUID:           f1e2d3c4-b5a6-7890-1234-567890abcdef
Status:         —
Milestone Date: 2026-09-15
...
```

### milestone show-schema

Display all available fields for the milestone entity. Useful for discovering field names for `--fields`, `query`, and `edit` commands.

```bash
msx-cli milestone show-schema [--filter <term>]
```

**Example — filter by keyword:**

```bash
msx-cli milestone show-schema --filter "status"
```

```
📋 Milestone Schema (7 fields)
┌──────────────────────────────────┬────────────────────────────┬──────────────┬──────┬────────┬────────┬────────────┐
│ Field Name                       │ Display Name               │ Type         │ Read │ Create │ Update │ Required   │
├──────────────────────────────────┼────────────────────────────┼──────────────┼──────┼────────┼────────┼────────────┤
│ msp_milestonestatus              │ Milestone Status           │ Picklist     │ ✓    │ ✓      │ ✓      │            │
├──────────────────────────────────┼────────────────────────────┼──────────────┼──────┼────────┼────────┼────────────┤
│ msp_milestonestatusreason        │ Milestone Status Reason    │ Picklist     │ ✓    │ ✓      │ ✓      │            │
├──────────────────────────────────┼────────────────────────────┼──────────────┼──────┼────────┼────────┼────────────┤
│ statecode                        │ Status                     │ State        │ ✓    │        │ ✓      │ SystemReq  │
│ ...                              │ ...                        │ ...          │ ...  │ ...    │ ...    │ ...        │
└──────────────────────────────────┴────────────────────────────┴──────────────┴──────┴────────┴────────┴────────────┘
```

**Column legend:**
- **Read** — field can be read via API
- **Create** — field can be set when creating a record
- **Update** — field can be modified on existing records
- **Required** — `SystemRequired` or `ApplicationRequired` if the field is mandatory

### milestone show-statuses

List all valid milestone status values. Use these labels with the `--status` filter.

```bash
msx-cli milestone show-statuses
```

```
📋 Milestone Status Values
   Use these labels with --status flag, e.g.: msx-cli milestone list --status OnTrack

┌──────────┬──────────────────────────────┬──────────────────────────────────────────────────┐
│ Value    │ Label                        │ Description                                      │
├──────────┼──────────────────────────────┼──────────────────────────────────────────────────┤
│ 86198... │ On Track                     │ —                                                │
├──────────┼──────────────────────────────┼──────────────────────────────────────────────────┤
│ 86198... │ At Risk                      │ —                                                │
├──────────┼──────────────────────────────┼──────────────────────────────────────────────────┤
│ 86198... │ Blocked                      │ —                                                │
├──────────┼──────────────────────────────┼──────────────────────────────────────────────────┤
│ 86198... │ Completed                    │ —                                                │
├──────────┼──────────────────────────────┼──────────────────────────────────────────────────┤
│ 86198... │ Cancelled                    │ —                                                │
├──────────┼──────────────────────────────┼──────────────────────────────────────────────────┤
│ 86198... │ Lost to Competitor           │ —                                                │
├──────────┼──────────────────────────────┼──────────────────────────────────────────────────┤
│ 86198... │ Hygiene/Duplicate            │ —                                                │
└──────────┴──────────────────────────────┴──────────────────────────────────────────────────┘
```

---

## Opportunities

Manage CRM opportunities. The `opportunity` command has an alias `oppty` for convenience — both are interchangeable.

```bash
# These are equivalent:
msx-cli opportunity list
msx-cli oppty list
```

### opportunity list

List opportunities.

```bash
msx-cli opportunity list [options]
# or: msx-cli oppty list [options]
```

| Option | Description | Default |
|---|---|---|
| `-a, --active` | Show only active opportunities | `false` |
| `-n, --top <number>` | Maximum results | `20` |
| `--fields <fields>` | Comma-separated fields to display | — |

**Example:**

```bash
msx-cli oppty list --active --top 5
```

```
📊 Opportunities (5 results)
┌────────────────────────────────────┬───────────────┬──────────────────┬────────────┬────────────┬──────────────────────┐
│ Name                               │ Est. Value    │ Stage            │ Status     │ Est. Close │ Owner                │
├────────────────────────────────────┼───────────────┼──────────────────┼────────────┼────────────┼──────────────────────┤
│ Contoso Cloud Migration            │ $2,500,000    │ Qualify          │ Open       │ 2026-09-30 │ John Doe             │
├────────────────────────────────────┼───────────────┼──────────────────┼────────────┼────────────┼──────────────────────┤
│ Fabrikam M365 Expansion            │ $850,000      │ Propose          │ Open       │ 2026-07-15 │ Jane Smith           │
├────────────────────────────────────┼───────────────┼──────────────────┼────────────┼────────────┼──────────────────────┤
│ Northwind Security Suite           │ $1,200,000    │ Close            │ Open       │ 2026-06-01 │ John Doe             │
│ ...                                │ ...           │ ...              │ ...        │ ...        │ ...                  │
└────────────────────────────────────┴───────────────┴──────────────────┴────────────┴────────────┴──────────────────────┘
```

### opportunity get

Get full details of a single opportunity by its GUID.

```bash
msx-cli oppty get <id>
```

**Example:**

```bash
msx-cli oppty get a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

```
📊 Opportunity Details
Name:           Contoso Cloud Migration
ID:             a1b2c3d4-e5f6-7890-abcd-ef1234567890
Stage:          Qualify
Status:         Open
Est. Value:     $2,500,000
Budget:         $3,000,000
Est. Close:     2026-09-30
Actual Value:   —
Actual Close:   —
Account:        Contoso Ltd
Owner:          John Doe
Created:        2026-01-10
Modified:       2026-03-08
Description:    Full cloud migration from on-premises infrastructure
Current Situation: Customer running legacy on-prem workloads
Customer Need:  Reduce operational costs and improve scalability
Proposed Solution: Azure IaaS + PaaS migration in 3 phases
```

### opportunity search

Search opportunities by name (partial match).

```bash
msx-cli oppty search <term> [options]
```

| Option | Description | Default |
|---|---|---|
| `-n, --top <number>` | Maximum results | `20` |
| `--fields <fields>` | Comma-separated fields to display | — |

**Example:**

```bash
msx-cli oppty search "Contoso"
```

```
🔍 Search results for "Contoso" (2)
┌────────────────────────────────────┬───────────────┬──────────────────┬────────────┬────────────┬──────────────────────┐
│ Name                               │ Est. Value    │ Stage            │ Status     │ Est. Close │ Owner                │
├────────────────────────────────────┼───────────────┼──────────────────┼────────────┼────────────┼──────────────────────┤
│ Contoso Cloud Migration            │ $2,500,000    │ Qualify          │ Open       │ 2026-09-30 │ John Doe             │
├────────────────────────────────────┼───────────────┼──────────────────┼────────────┼────────────┼──────────────────────┤
│ Contoso Teams Deployment           │ $400,000      │ Develop          │ Open       │ 2026-11-15 │ Jane Smith           │
└────────────────────────────────────┴───────────────┴──────────────────┴────────────┴────────────┴──────────────────────┘
```

### opportunity edit

Update fields on an existing opportunity.

```bash
msx-cli oppty edit <id> <field=value...>
```

**Example:**

```bash
msx-cli oppty edit a1b2c3d4-e5f6-7890-abcd-ef1234567890 estimatedvalue=3000000 description="Updated scope"
```

```
✔ Opportunity updated.

Name:           Contoso Cloud Migration
...
Est. Value:     $3,000,000
Description:    Updated scope
```

### opportunity show-schema

Display all available fields for the opportunity entity.

```bash
msx-cli oppty show-schema [--filter <term>]
```

**Example:**

```bash
msx-cli oppty show-schema --filter "value"
```

```
📋 Opportunity Schema (4 fields)
┌──────────────────────────────────┬────────────────────────────┬──────────────┬──────┬────────┬────────┬────────────┐
│ Field Name                       │ Display Name               │ Type         │ Read │ Create │ Update │ Required   │
├──────────────────────────────────┼────────────────────────────┼──────────────┼──────┼────────┼────────┼────────────┤
│ actualvalue                      │ Actual Revenue             │ Money        │ ✓    │ ✓      │ ✓      │            │
├──────────────────────────────────┼────────────────────────────┼──────────────┼──────┼────────┼────────┼────────────┤
│ estimatedvalue                   │ Est. Revenue               │ Money        │ ✓    │ ✓      │ ✓      │            │
│ ...                              │ ...                        │ ...          │ ...  │ ...    │ ...    │ ...        │
└──────────────────────────────────┴────────────────────────────┴──────────────┴──────┴────────┴────────┴────────────┘
```

---

## Earnings

View earnings from won (closed-won) opportunities.

```bash
msx-cli earnings [options]
```

| Option | Description | Default |
|---|---|---|
| `-y, --year <year>` | Filter by fiscal year (e.g. `2026`) | All time |
| `-u, --user <email>` | Filter by user email | You |

**Example — your lifetime earnings:**

```bash
msx-cli earnings
```

```
💰 Earnings (all time)
   Total: $4,750,000
   Won opportunities: 8

┌────────────────────────────────────┬────────────────┬──────────────┬──────────────────────────────┐
│ Name                               │ Actual Value   │ Close Date   │ Account                      │
├────────────────────────────────────┼────────────────┼──────────────┼──────────────────────────────┤
│ Contoso Security Suite             │ $1,200,000     │ 2026-02-28   │ Contoso Ltd                  │
├────────────────────────────────────┼────────────────┼──────────────┼──────────────────────────────┤
│ Fabrikam Azure Expansion           │ $850,000       │ 2025-11-15   │ Fabrikam Inc                 │
│ ...                                │ ...            │ ...          │ ...                          │
└────────────────────────────────────┴────────────────┴──────────────┴──────────────────────────────┘
```

**Example — earnings for a specific year:**

```bash
msx-cli earnings --year 2026
```

**Example — earnings for a colleague:**

```bash
msx-cli earnings --user jane.smith@microsoft.com --year 2026
```

---

## Generic Query

Explore any Dynamics 365 CRM entity directly using OData queries. This is a power-user tool for discovering entities and data.

```bash
msx-cli query <entity> [options]
```

| Option | Description | Default |
|---|---|---|
| `-q, --odata <query>` | Full OData query string | `$top=<n>` |
| `-n, --top <number>` | Number of results (when no OData query given) | `5` |

**Example — peek at an entity:**

```bash
msx-cli query systemusers --top 2
```

```
🔍 systemusers (2 results)
[
  {
    "systemuserid": "a1b2c3d4-...",
    "fullname": "John Doe",
    "internalemailaddress": "john.doe@microsoft.com",
    ...
  },
  ...
]
```

**Example — custom OData query:**

```bash
msx-cli query accounts -q "$filter=name eq 'Contoso Ltd'&$select=name,accountid,revenue&$top=1"
```

```
🔍 accounts (1 results)
[
  {
    "name": "Contoso Ltd",
    "accountid": "f1e2d3c4-...",
    "revenue": 50000000
  }
]
```

> **Tip:** Use this command to explore custom entities. For example, to discover what entities exist:
> ```bash
> msx-cli query EntityDefinitions -q "$select=LogicalName,DisplayName&$top=10"
> ```

---

## Tips & Tricks

### Custom field display with `--fields`

Both milestone and opportunity commands support `--fields` to choose exactly which columns appear in the output. Use the entity's logical field names (discoverable via `show-schema`):

```bash
msx-cli milestone list --fields "msp_milestonenumber,msp_name,msp_milestonestatus,msp_milestonedate"
msx-cli oppty list --fields "name,estimatedvalue,stepname,createdon"
```

### Discover field names with `show-schema`

Not sure what fields are available? Use `show-schema` with an optional `--filter`:

```bash
msx-cli milestone show-schema                  # show all fields
msx-cli milestone show-schema --filter "date"  # fields containing "date"
msx-cli oppty show-schema --filter "account"   # fields containing "account"
```

### Status filtering for milestones

First, check available statuses:

```bash
msx-cli milestone show-statuses
```

Then use the label with `--status`:

```bash
msx-cli milestone list --status "On Track"
msx-cli milestone query --status "At Risk" --user jane.smith@microsoft.com
```

### Milestone IDs vs GUIDs

MSX milestones have two identifiers:
- **Milestone number** (e.g. `7-501234567`) — the human-readable ID shown in the MSX web UI
- **GUID** (e.g. `a1b2c3d4-e5f6-7890-abcd-ef1234567890`) — the internal Dynamics 365 primary key

The CLI accepts either format for `get` and `edit` commands. It auto-detects the format and resolves accordingly.

### Combining date filters

Query milestones within a date range:

```bash
msx-cli milestone query --after 2026-01-01 --before 2026-06-30
```

### Quick alias

Use `oppty` instead of `opportunity` to save keystrokes:

```bash
msx-cli oppty list --active
msx-cli oppty search "Contoso"
msx-cli oppty get <guid>
```
