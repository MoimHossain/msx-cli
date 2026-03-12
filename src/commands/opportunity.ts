import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import {
  listOpportunities, getOpportunity, searchOpportunities,
  updateOpportunity, getEntitySchema, buildSelect,
  type Opportunity,
} from "../api.js";
import {
  fmt, fmtDate, fmtMoney, fmtStatus, fmtOwner, fmtAccount,
  wrapAction, parseEditFields, schemaTable, dynamicTable,
} from "../helpers.js";

// ─── Opportunity-specific helpers ────────────────────────────────────

function opportunityTable(opps: Opportunity[], opts: { showOwner?: boolean } = {}): Table.Table {
  const heads = [
    chalk.cyan("Name"),
    chalk.cyan("Est. Value"),
    chalk.cyan("Stage"),
    chalk.cyan("Status"),
    chalk.cyan("Est. Close"),
  ];
  const widths = [36, 15, 18, 12, 12];

  if (opts.showOwner) {
    heads.push(chalk.cyan("Owner"));
    widths.push(22);
  }

  const table = new Table({ head: heads, colWidths: widths, wordWrap: true });
  for (const o of opps) {
    const row = [
      fmt(o.name),
      fmtMoney(o, "estimatedvalue"),
      fmt(o.stepname),
      fmtStatus(o),
      fmtDate(o.estimatedclosedate),
    ];
    if (opts.showOwner) row.push(fmtOwner(o));
    table.push(row);
  }
  return table;
}

function opportunityDetail(o: Opportunity): string {
  const lines = [
    `${chalk.bold("Name:")}           ${fmt(o.name)}`,
    `${chalk.bold("ID:")}             ${o.opportunityid}`,
    `${chalk.bold("Stage:")}          ${fmt(o.stepname)}`,
    `${chalk.bold("Status:")}         ${fmtStatus(o)}`,
    `${chalk.bold("Est. Value:")}     ${fmtMoney(o, "estimatedvalue")}`,
    `${chalk.bold("Budget:")}         ${fmtMoney(o, "budgetamount")}`,
    `${chalk.bold("Est. Close:")}     ${fmtDate(o.estimatedclosedate)}`,
    `${chalk.bold("Actual Value:")}   ${fmtMoney(o, "actualvalue")}`,
    `${chalk.bold("Actual Close:")}   ${fmtDate(o.actualclosedate)}`,
    `${chalk.bold("Account:")}        ${fmtAccount(o)}`,
    `${chalk.bold("Owner:")}          ${fmtOwner(o)}`,
    `${chalk.bold("Created:")}        ${fmtDate(o.createdon)}`,
    `${chalk.bold("Modified:")}       ${fmtDate(o.modifiedon)}`,
    `${chalk.bold("Description:")}    ${fmt(o.description)}`,
    `${chalk.bold("Current Situation:")} ${fmt(o.currentsituation)}`,
    `${chalk.bold("Customer Need:")}  ${fmt(o.customerneed)}`,
    `${chalk.bold("Proposed Solution:")} ${fmt(o.proposedsolution)}`,
  ];
  return lines.join("\n");
}

// ─── Register opportunity commands ───────────────────────────────────

export function registerOpportunityCommands(program: Command): void {
  const opp = program
    .command("opportunity")
    .description("Manage opportunities");

  opp.command("list")
    .description("List opportunities")
    .option("-a, --active", "Active only", false)
    .option("-n, --top <number>", "Max results", "20")
    .option("--fields <fields>", "Comma-separated fields to display")
    .action(wrapAction(async (opts) => {
      const spinner = ora("Fetching opportunities...").start();
      const opps = await listOpportunities({
        active: opts.active,
        top: parseInt(opts.top, 10),
        select: opts.fields ? buildSelect(opts.fields, "") : undefined,
      });
      spinner.stop();
      if (opps.length === 0) {
        console.log(chalk.yellow("No opportunities found."));
        return;
      }
      console.log();
      console.log(chalk.bold(`📊 Opportunities (${opps.length} results)`));
      if (opts.fields) {
        console.log(dynamicTable(opps as unknown as Record<string, unknown>[], opts.fields.split(",").map((f: string) => f.trim())).toString());
      } else {
        console.log(opportunityTable(opps, { showOwner: true }).toString());
      }
    }));

  opp.command("get <id>")
    .description("Get full details of an opportunity")
    .action(wrapAction(async (id: string) => {
      const spinner = ora("Fetching opportunity...").start();
      const o = await getOpportunity(id);
      spinner.stop();
      console.log();
      console.log(chalk.bold("📊 Opportunity Details"));
      console.log(opportunityDetail(o));
    }));

  opp.command("search <term>")
    .description("Search opportunities by name")
    .option("-n, --top <number>", "Max results", "20")
    .option("--fields <fields>", "Comma-separated fields to display")
    .action(wrapAction(async (term: string, opts) => {
      const spinner = ora(`Searching "${term}"...`).start();
      const opps = await searchOpportunities(term, parseInt(opts.top, 10), opts.fields ? buildSelect(opts.fields, "") : undefined);
      spinner.stop();
      if (opps.length === 0) {
        console.log(chalk.yellow(`No opportunities matching "${term}".`));
        return;
      }
      console.log();
      console.log(chalk.bold(`🔍 Search results for "${term}" (${opps.length})`));
      if (opts.fields) {
        console.log(dynamicTable(opps as unknown as Record<string, unknown>[], opts.fields.split(",").map((f: string) => f.trim())).toString());
      } else {
        console.log(opportunityTable(opps, { showOwner: true }).toString());
      }
    }));

  opp.command("edit <id>")
    .description("Edit an opportunity (field=value pairs)")
    .argument("<fields...>", 'Fields to update, e.g. name="New Name" estimatedvalue=100000')
    .action(wrapAction(async (id: string, fields: string[]) => {
      const data = parseEditFields(fields);
      const spinner = ora("Updating opportunity...").start();
      await updateOpportunity(id, data);
      spinner.succeed("Opportunity updated.");
      const o = await getOpportunity(id);
      console.log();
      console.log(opportunityDetail(o));
    }));

  opp.command("show-schema")
    .description("Show the schema (available fields) for opportunities")
    .option("--filter <term>", "Filter fields by name (partial match)")
    .action(wrapAction(async (opts) => {
      const spinner = ora("Fetching opportunity schema...").start();
      let fields = await getEntitySchema("opportunity");
      spinner.stop();
      if (opts.filter) {
        const lower = opts.filter.toLowerCase();
        fields = fields.filter(f =>
          f.name.toLowerCase().includes(lower) || f.displayName.toLowerCase().includes(lower)
        );
      }
      console.log();
      console.log(chalk.bold(`📋 Opportunity Schema (${fields.length} fields)`));
      console.log(schemaTable(fields).toString());
    }));
}
