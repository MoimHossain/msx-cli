import chalk from "chalk";
import Table from "cli-table3";
import {
  getMyUserId, lookupUserByEmail,
  type Opportunity, type SchemaField, type PicklistOption,
} from "./api.js";

// ─── Generic formatters ──────────────────────────────────────────────

export function fmt(val: unknown): string {
  if (val === null || val === undefined) return chalk.dim("—");
  return String(val);
}

export function fmtDate(dateStr?: string): string {
  return dateStr ? dateStr.slice(0, 10) : chalk.dim("—");
}

export function fmtMoney(opp: Opportunity, field: "estimatedvalue" | "actualvalue" | "budgetamount"): string {
  const formatted = opp[`${field}@OData.Community.Display.V1.FormattedValue` as keyof Opportunity] as string | undefined;
  if (formatted) return formatted;
  const raw = opp[field] as number | undefined;
  return raw != null ? `$${raw.toLocaleString()}` : chalk.dim("—");
}

export function fmtStatus(opp: Opportunity): string {
  return (opp["statuscode@OData.Community.Display.V1.FormattedValue"] as string) ?? String(opp.statuscode ?? "—");
}

export function fmtOwner(opp: Opportunity): string {
  return (opp["_ownerid_value@OData.Community.Display.V1.FormattedValue"] as string) ?? chalk.dim("—");
}

export function fmtAccount(opp: Opportunity): string {
  return (opp["_parentaccountid_value@OData.Community.Display.V1.FormattedValue"] as string) ?? chalk.dim("—");
}

// ─── Utility helpers ─────────────────────────────────────────────────

export async function resolveUserId(email?: string): Promise<string> {
  if (!email) return getMyUserId();
  const user = await lookupUserByEmail(email);
  if (!user) throw new Error(`User not found: ${email}`);
  return user.systemuserid;
}

export function parseEditFields(fields: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const f of fields) {
    const idx = f.indexOf("=");
    if (idx === -1) throw new Error(`Invalid field format "${f}". Use field=value`);
    const key = f.slice(0, idx).trim();
    const val = f.slice(idx + 1).trim();
    const num = Number(val);
    result[key] = !isNaN(num) && val !== "" ? num : val;
  }
  return result;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function wrapAction(fn: (...args: any[]) => Promise<void>): (...args: any[]) => void {
  return (...args: any[]) => {
    fn(...args).catch((err: Error) => {
      console.error(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    });
  };
}

// ─── Table helpers ───────────────────────────────────────────────────

export function schemaTable(fields: SchemaField[]): Table.Table {
  const table = new Table({
    head: [
      chalk.cyan("Field Name"),
      chalk.cyan("Display Name"),
      chalk.cyan("Type"),
      chalk.cyan("Read"),
      chalk.cyan("Create"),
      chalk.cyan("Update"),
      chalk.cyan("Required"),
    ],
    colWidths: [34, 28, 14, 6, 8, 8, 12],
    wordWrap: true,
  });
  for (const f of fields) {
    table.push([
      f.name,
      f.displayName,
      f.type,
      f.readable ? "✓" : "",
      f.creatable ? "✓" : "",
      f.updatable ? "✓" : "",
      f.required === "None" ? "" : f.required,
    ]);
  }
  return table;
}

export function picklistTable(options: PicklistOption[]): Table.Table {
  const table = new Table({
    head: [chalk.cyan("Value"), chalk.cyan("Label"), chalk.cyan("Description")],
    colWidths: [10, 30, 50],
    wordWrap: true,
  });
  for (const o of options) {
    table.push([String(o.value), o.label, o.description || chalk.dim("—")]);
  }
  return table;
}

export function dynamicTable(records: Record<string, unknown>[], fields: string[]): Table.Table {
  const heads = fields.map(f => chalk.cyan(f));
  const widths = fields.map(f => Math.max(f.length + 4, 14));
  const table = new Table({ head: heads, colWidths: widths, wordWrap: true });
  for (const r of records) {
    const row = fields.map(f => {
      const annotated = `${f}@OData.Community.Display.V1.FormattedValue`;
      return fmt(r[annotated] ?? r[f]);
    });
    table.push(row);
  }
  return table;
}
