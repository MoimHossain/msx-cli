import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { queryEntity } from "../api.js";
import { wrapAction } from "../helpers.js";

export function registerQueryCommand(program: Command): void {
  program
    .command("query <entity>")
    .description("Query any CRM entity (for exploration)")
    .option("-q, --odata <query>", "OData query string")
    .option("-n, --top <number>", "Number of results", "5")
    .action(wrapAction(async (entity: string, opts) => {
      const spinner = ora(`Querying ${entity}...`).start();
      const queryStr = opts.odata || `$top=${opts.top}`;
      const results = await queryEntity(entity, queryStr);
      spinner.stop();
      console.log();
      console.log(chalk.bold(`🔍 ${entity} (${results.length} results)`));
      console.log(JSON.stringify(results, null, 2));
    }));
}
