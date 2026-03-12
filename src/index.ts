#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { login, logout, getAccountInfo } from "./auth.js";
import { listOpportunities, listActiveOpportunities, listMyMilestones, queryEntity } from "./api.js";

const program = new Command();

program
  .name("msx-cli")
  .description("AI-powered CLI for Microsoft Dynamics 365 (MSX)")
  .version("0.1.0");

// --- Login ---
program
  .command("login")
  .description("Sign in to MSX using device code flow")
  .action(async () => {
    try {
      const result = await login();
      console.log();
      console.log(chalk.green(`✅ Signed in as ${chalk.bold(result.account?.username)}`));
      console.log(chalk.dim("   Token cached for future sessions."));
    } catch (err: unknown) {
      console.error(chalk.red(`❌ Login failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// --- Logout ---
program
  .command("logout")
  .description("Sign out and clear cached tokens")
  .action(async () => {
    await logout();
    console.log(chalk.green("✅ Signed out. Token cache cleared."));
  });

// --- Whoami ---
program
  .command("whoami")
  .description("Show current signed-in account")
  .action(async () => {
    const info = await getAccountInfo();
    if (!info) {
      console.log(chalk.yellow("⚠️  Not signed in. Run `msx-cli login` first."));
    } else {
      console.log(chalk.green(`👤 ${info.name} (${info.username})`));
    }
  });

// --- Opportunities ---
program
  .command("opportunities")
  .description("List opportunities from MSX")
  .option("-a, --active", "Show only active opportunities", false)
  .option("-n, --top <number>", "Number of results", "20")
  .action(async (opts) => {
    const spinner = ora("Fetching opportunities...").start();
    try {
      const top = parseInt(opts.top, 10);
      const opps = opts.active
        ? await listActiveOpportunities(top)
        : await listOpportunities(top);

      spinner.stop();

      if (opps.length === 0) {
        console.log(chalk.yellow("No opportunities found."));
        return;
      }

      const table = new Table({
        head: [
          chalk.cyan("Name"),
          chalk.cyan("Est. Value"),
          chalk.cyan("Stage"),
          chalk.cyan("Status"),
          chalk.cyan("Est. Close"),
          chalk.cyan("Modified"),
        ],
        colWidths: [40, 15, 20, 12, 14, 14],
        wordWrap: true,
      });

      for (const opp of opps) {
        table.push([
          opp.name ?? "—",
          opp["estimatedvalue@OData.Community.Display.V1.FormattedValue"] ??
            (opp.estimatedvalue != null ? `$${opp.estimatedvalue.toLocaleString()}` : "—"),
          opp.stepname ?? "—",
          opp["statuscode@OData.Community.Display.V1.FormattedValue"] ?? String(opp.statuscode ?? "—"),
          opp.estimatedclosedate?.slice(0, 10) ?? "—",
          opp.modifiedon?.slice(0, 10) ?? "—",
        ]);
      }

      console.log();
      console.log(chalk.bold(`📊 Opportunities (${opps.length} results)`));
      console.log(table.toString());
    } catch (err: unknown) {
      spinner.fail("Failed to fetch opportunities");
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

// --- Milestones (my opportunities by stage) ---
program
  .command("milestones")
  .description("List my opportunities and their current sales stage")
  .option("-n, --top <number>", "Number of results", "50")
  .action(async (opts) => {
    const spinner = ora("Fetching your milestones...").start();
    try {
      const top = parseInt(opts.top, 10);
      const milestones = await listMyMilestones(top);
      spinner.stop();

      if (milestones.length === 0) {
        console.log(chalk.yellow("No active opportunities assigned to you."));
        return;
      }

      const table = new Table({
        head: [
          chalk.cyan("Opportunity"),
          chalk.cyan("Stage"),
          chalk.cyan("Est. Value"),
          chalk.cyan("Status"),
          chalk.cyan("Est. Close"),
          chalk.cyan("Modified"),
        ],
        colWidths: [40, 20, 15, 12, 14, 14],
        wordWrap: true,
      });

      for (const m of milestones) {
        table.push([
          m.name ?? "—",
          m.stepname ?? "—",
          m["estimatedvalue@OData.Community.Display.V1.FormattedValue"] ??
            (m.estimatedvalue != null ? `$${m.estimatedvalue.toLocaleString()}` : "—"),
          m["statuscode@OData.Community.Display.V1.FormattedValue"] ?? String(m.statuscode ?? "—"),
          m.estimatedclosedate?.slice(0, 10) ?? "—",
          m.modifiedon?.slice(0, 10) ?? "—",
        ]);
      }

      console.log();
      console.log(chalk.bold(`🏁 My Milestones (${milestones.length} active opportunities)`));
      console.log(table.toString());
    } catch (err: unknown) {
      spinner.fail("Failed to fetch milestones");
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

// --- Generic query (for exploration) ---
program
  .command("query <entity>")
  .description("Query any CRM entity (e.g., `msx-cli query accounts`)")
  .option("-q, --odata <query>", "OData query string", "")
  .option("-n, --top <number>", "Number of results", "5")
  .action(async (entity: string, opts) => {
    const spinner = ora(`Querying ${entity}...`).start();
    try {
      const queryStr = opts.odata || `$top=${opts.top}`;
      const results = await queryEntity(entity, queryStr);
      spinner.stop();

      console.log();
      console.log(chalk.bold(`🔍 ${entity} (${results.length} results)`));
      console.log(JSON.stringify(results, null, 2));
    } catch (err: unknown) {
      spinner.fail(`Failed to query ${entity}`);
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program.parse();
