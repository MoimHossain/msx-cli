import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { getEarnings } from "../api.js";
import { fmt, fmtDate, fmtMoney, fmtAccount, wrapAction, resolveUserId } from "../helpers.js";
import { getMyUserId } from "../api.js";

export function registerEarningsCommand(program: Command): void {
  program
    .command("earnings")
    .description("View earnings from won opportunities")
    .option("-y, --year <year>", "Filter by year (e.g. 2026)")
    .option("-u, --user <email>", "Filter by user email (default: you)")
    .action(wrapAction(async (opts) => {
      const spinner = ora("Fetching earnings...").start();
      let userId: string | undefined;
      if (opts.user) {
        userId = await resolveUserId(opts.user);
      } else {
        userId = await getMyUserId();
      }
      const year = opts.year ? parseInt(opts.year, 10) : undefined;
      const earnings = await getEarnings({ userId, year });
      spinner.stop();

      const label = year ? `in ${year}` : "all time";
      console.log();
      console.log(chalk.bold(`💰 Earnings (${label})`));
      console.log(chalk.green.bold(`   Total: $${earnings.totalWon.toLocaleString()}`));
      console.log(chalk.dim(`   Won opportunities: ${earnings.count}`));

      if (earnings.opportunities.length > 0) {
        console.log();
        const table = new Table({
          head: [
            chalk.cyan("Name"),
            chalk.cyan("Actual Value"),
            chalk.cyan("Close Date"),
            chalk.cyan("Account"),
          ],
          colWidths: [36, 16, 14, 30],
          wordWrap: true,
        });
        for (const o of earnings.opportunities) {
          table.push([
            fmt(o.name),
            fmtMoney(o, "actualvalue"),
            fmtDate(o.actualclosedate),
            fmtAccount(o),
          ]);
        }
        console.log(table.toString());
      }
    }));
}
