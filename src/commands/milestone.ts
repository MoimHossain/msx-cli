import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import {
  getMyUserId,
  listMilestones, getMilestone, getMilestoneByNumber,
  updateMilestone, createMilestone,
  getEntitySchema, getPicklistOptions,
  buildSelect, resolveMilestoneStatusValue,
  type Milestone,
} from "../api.js";
import {
  fmt, fmtDate, wrapAction, parseEditFields, resolveUserId,
  schemaTable, picklistTable, dynamicTable,
} from "../helpers.js";

// ─── Milestone-specific helpers ──────────────────────────────────────

function fmtMilestoneAnnotation(m: Milestone, field: string): string {
  const key = `${field}@OData.Community.Display.V1.FormattedValue` as keyof Milestone;
  return (m[key] as string) ?? fmt(m[field as keyof Milestone]);
}

function fmtOwnerFromMilestone(m: Milestone): string {
  return (m["_ownerid_value@OData.Community.Display.V1.FormattedValue"] as string) ?? chalk.dim("—");
}

function milestoneTable(milestones: Milestone[], opts: { showOwner?: boolean } = {}): Table.Table {
  const heads = [
    chalk.cyan("Milestone #"),
    chalk.cyan("Name"),
    chalk.cyan("Status"),
    chalk.cyan("Date"),
    chalk.cyan("Account"),
    chalk.cyan("Area"),
  ];
  const widths = [16, 28, 16, 12, 24, 16];

  if (opts.showOwner) {
    heads.push(chalk.cyan("Owner"));
    widths.push(20);
  }

  const table = new Table({ head: heads, colWidths: widths, wordWrap: true });
  for (const m of milestones) {
    const row = [
      fmt(m.msp_milestonenumber),
      fmt(m.msp_name),
      fmtMilestoneAnnotation(m, "msp_milestonestatus"),
      fmtDate(m.msp_milestonedate),
      fmt(m.msp_uataccountname),
      fmt(m.msp_uatarea),
    ];
    if (opts.showOwner) row.push(m.msp_uatmilestoneowner ?? fmtOwnerFromMilestone(m));
    table.push(row);
  }
  return table;
}

function milestoneDetail(m: Milestone): string {
  const lines = [
    `${chalk.bold("Milestone #:")}    ${fmt(m.msp_milestonenumber)}`,
    `${chalk.bold("Name:")}           ${fmt(m.msp_name)}`,
    `${chalk.bold("GUID:")}           ${m.msp_engagementmilestoneid}`,
    `${chalk.bold("Status:")}         ${fmtMilestoneAnnotation(m, "msp_milestonestatus")}`,
    `${chalk.bold("Status Reason:")}  ${fmtMilestoneAnnotation(m, "msp_milestonestatusreason")}`,
    `${chalk.bold("Category:")}       ${fmtMilestoneAnnotation(m, "msp_milestonecategory")}`,
    `${chalk.bold("Workload:")}       ${fmtMilestoneAnnotation(m, "msp_milestoneworkload")}`,
    `${chalk.bold("Solution Area:")}  ${fmtMilestoneAnnotation(m, "msp_milestonesolutionarea")}`,
    `${chalk.bold("Milestone Date:")} ${fmtDate(m.msp_milestonedate)}`,
    `${chalk.bold("Completed:")}      ${fmtMilestoneAnnotation(m, "msp_completed")}`,
    `${chalk.bold("Completed On:")}   ${fmtDate(m.msp_completedon)}`,
    `${chalk.bold("Commitment:")}     ${fmtMilestoneAnnotation(m, "msp_commitmentrecommendation")}`,
    `${chalk.bold("Help Needed:")}    ${fmtMilestoneAnnotation(m, "msp_helpneeded")}`,
    `${chalk.bold("Account:")}        ${fmt(m.msp_uataccountname)}`,
    `${chalk.bold("Area:")}           ${fmt(m.msp_uatarea)}`,
    `${chalk.bold("Entity:")}         ${fmt(m.msp_uatentityname)}`,
    `${chalk.bold("Owner:")}          ${m.msp_uatmilestoneowner ?? fmtOwnerFromMilestone(m)}`,
    `${chalk.bold("Activations:")}    ${fmt(m.msp_noofactivations)}`,
    `${chalk.bold("Seats:")}          ${fmt(m.msp_seatsentitlements)}`,
    `${chalk.bold("BACV:")}           ${fmt(m.msp_bacvrate)}`,
    `${chalk.bold("Est. Monthly:")}   ${fmtMilestoneAnnotation(m, "msp_monthlyuse")}`,
    `${chalk.bold("Comments:")}       ${fmt(m.msp_forecastcomments)}`,
    `${chalk.bold("Risk/Blockers:")}  ${fmt(m.msp_milestonecomments)}`,
    `${chalk.bold("Created:")}        ${fmtDate(m.createdon)}`,
    `${chalk.bold("Modified:")}       ${fmtDate(m.modifiedon)}`,
  ];
  return lines.join("\n");
}

async function resolveMilestoneId(idOrNumber: string): Promise<{ guid: string; milestone?: Milestone }> {
  if (idOrNumber.match(/^\d+-\d+$/)) {
    const m = await getMilestoneByNumber(idOrNumber);
    if (!m) throw new Error(`Milestone not found: ${idOrNumber}`);
    return { guid: m.msp_engagementmilestoneid, milestone: m };
  }
  return { guid: idOrNumber };
}

// ─── Register milestone commands ─────────────────────────────────────

export function registerMilestoneCommands(program: Command): void {
  const ms = program
    .command("milestone")
    .description("Manage MSX milestones (msp_engagementmilestones)");

  ms.command("list")
    .description("List your active milestones")
    .option("-n, --top <number>", "Max results", "50")
    .option("--all", "Include inactive milestones", false)
    .option("--status <status>", "Filter by status label (e.g. Completed, OnTrack)")
    .option("--fields <fields>", "Comma-separated fields to display")
    .action(wrapAction(async (opts) => {
      const spinner = ora("Fetching your milestones...").start();

      let statusValue: number | undefined;
      if (opts.status) {
        spinner.text = "Resolving status value...";
        const resolved = await resolveMilestoneStatusValue(opts.status);
        if (resolved == null) {
          spinner.fail(`Unknown milestone status: "${opts.status}". Use 'msx-cli milestone show-statuses' to see valid values.`);
          return;
        }
        statusValue = resolved;
      }

      const userId = await getMyUserId();
      spinner.text = "Fetching milestones...";
      const items = await listMilestones({
        userId,
        activeOnly: !opts.all,
        status: statusValue,
        top: parseInt(opts.top, 10),
        select: opts.fields ? buildSelect(opts.fields, "") : undefined,
      });
      spinner.stop();
      if (items.length === 0) {
        console.log(chalk.yellow("No milestones found."));
        return;
      }
      console.log();
      const label = opts.status ? `My Milestones (status: ${opts.status})` : "My Milestones";
      console.log(chalk.bold(`🏁 ${label} (${items.length} results)`));
      if (opts.fields) {
        console.log(dynamicTable(items as unknown as Record<string, unknown>[], opts.fields.split(",").map((f: string) => f.trim())).toString());
      } else {
        console.log(milestoneTable(items).toString());
      }
    }));

  ms.command("get <id>")
    .description("Get details of a milestone (by milestone # or GUID)")
    .action(wrapAction(async (id: string) => {
      const spinner = ora("Fetching milestone...").start();
      const { guid, milestone: cached } = await resolveMilestoneId(id);
      const m = cached ?? await getMilestone(guid);
      spinner.stop();
      console.log();
      console.log(chalk.bold("🏁 Milestone Details"));
      console.log(milestoneDetail(m));
    }));

  ms.command("query")
    .description("Query milestones with filters")
    .option("-u, --user <email>", "Filter by user email address")
    .option("-s, --name <name>", "Filter by milestone name (partial match)")
    .option("--status <status>", "Filter by status label (e.g. Completed, OnTrack)")
    .option("--before <date>", "Milestone date before (YYYY-MM-DD)")
    .option("--after <date>", "Milestone date after (YYYY-MM-DD)")
    .option("--all", "Include inactive milestones", false)
    .option("-n, --top <number>", "Max results", "50")
    .option("--fields <fields>", "Comma-separated fields to display")
    .action(wrapAction(async (opts) => {
      const spinner = ora("Querying milestones...").start();
      let userId: string | undefined;
      if (opts.user) {
        userId = await resolveUserId(opts.user);
        spinner.text = "Fetching milestones...";
      }

      let statusValue: number | undefined;
      if (opts.status) {
        spinner.text = "Resolving status value...";
        const resolved = await resolveMilestoneStatusValue(opts.status);
        if (resolved == null) {
          spinner.fail(`Unknown milestone status: "${opts.status}". Use 'msx-cli milestone show-statuses' to see valid values.`);
          return;
        }
        statusValue = resolved;
      }

      const items = await listMilestones({
        userId,
        name: opts.name,
        dateBefore: opts.before,
        dateAfter: opts.after,
        activeOnly: !opts.all,
        status: statusValue,
        top: parseInt(opts.top, 10),
        select: opts.fields ? buildSelect(opts.fields, "") : undefined,
      });
      spinner.stop();
      if (items.length === 0) {
        console.log(chalk.yellow("No milestones match your query."));
        return;
      }
      const label = opts.user ? `milestones for ${opts.user}` : "milestones";
      console.log();
      console.log(chalk.bold(`🔍 Found ${items.length} ${label}`));
      if (opts.fields) {
        console.log(dynamicTable(items as unknown as Record<string, unknown>[], opts.fields.split(",").map((f: string) => f.trim())).toString());
      } else {
        console.log(milestoneTable(items, { showOwner: !opts.user }).toString());
      }
    }));

  ms.command("edit <id>")
    .description("Edit a milestone (field=value pairs)")
    .argument("<fields...>", 'Fields to update, e.g. msp_name="New Name"')
    .action(wrapAction(async (id: string, fields: string[]) => {
      const data = parseEditFields(fields);
      const spinner = ora("Updating milestone...").start();
      const { guid } = await resolveMilestoneId(id);
      await updateMilestone(guid, data);
      spinner.succeed("Milestone updated.");
      const m = await getMilestone(guid);
      console.log();
      console.log(milestoneDetail(m));
    }));

  ms.command("add")
    .description("Create a new milestone")
    .requiredOption("--name <name>", "Milestone name")
    .option("--date <date>", "Milestone date (YYYY-MM-DD)")
    .action(wrapAction(async (opts) => {
      const fields: Record<string, unknown> = { msp_name: opts.name };
      if (opts.date) fields.msp_milestonedate = opts.date;

      const spinner = ora("Creating milestone...").start();
      const m = await createMilestone(fields);
      spinner.succeed("Milestone created.");
      console.log();
      console.log(milestoneDetail(m));
    }));

  ms.command("show-schema")
    .description("Show the schema (available fields) for milestones")
    .option("--filter <term>", "Filter fields by name (partial match)")
    .action(wrapAction(async (opts) => {
      const spinner = ora("Fetching milestone schema...").start();
      let fields = await getEntitySchema("msp_engagementmilestone");
      spinner.stop();
      if (opts.filter) {
        const lower = opts.filter.toLowerCase();
        fields = fields.filter(f =>
          f.name.toLowerCase().includes(lower) || f.displayName.toLowerCase().includes(lower)
        );
      }
      console.log();
      console.log(chalk.bold(`📋 Milestone Schema (${fields.length} fields)`));
      console.log(schemaTable(fields).toString());
    }));

  ms.command("show-statuses")
    .description("Show all valid milestone status values")
    .action(wrapAction(async () => {
      const spinner = ora("Fetching milestone statuses...").start();
      const options = await getPicklistOptions("msp_engagementmilestone", "msp_milestonestatus");
      spinner.stop();
      console.log();
      console.log(chalk.bold("📋 Milestone Status Values"));
      console.log(chalk.dim("   Use these labels with --status flag, e.g.: msx-cli milestone list --status OnTrack"));
      console.log();
      console.log(picklistTable(options).toString());
    }));
}
