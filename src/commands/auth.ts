import { Command } from "commander";
import chalk from "chalk";
import { login, logout, getAccountInfo } from "../auth.js";
import { wrapAction } from "../helpers.js";

export function registerAuthCommands(program: Command): void {
  program
    .command("login")
    .description("Sign in to MSX via browser (device-compliant)")
    .action(wrapAction(async () => {
      const result = await login();
      console.log();
      console.log(chalk.green(`✅ Signed in as ${chalk.bold(result.account?.username)}`));
      console.log(chalk.dim("   Token cached for future sessions."));
    }));

  program
    .command("logout")
    .description("Sign out and clear cached tokens")
    .action(wrapAction(async () => {
      await logout();
      console.log(chalk.green("✅ Signed out. Token cache cleared."));
    }));

  program
    .command("whoami")
    .description("Show current signed-in account")
    .action(wrapAction(async () => {
      const info = await getAccountInfo();
      if (!info) {
        console.log(chalk.yellow("⚠️  Not signed in. Run `msx-cli login` first."));
      } else {
        console.log(chalk.green(`👤 ${info.name} (${info.username})`));
      }
    }));
}
