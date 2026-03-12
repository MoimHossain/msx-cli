#!/usr/bin/env node

import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerMilestoneCommands } from "./commands/milestone.js";
import { registerOpportunityCommands } from "./commands/opportunity.js";
import { registerEarningsCommand } from "./commands/earnings.js";
import { registerQueryCommand } from "./commands/query.js";

const program = new Command();

program
  .name("msx-cli")
  .description("AI-powered CLI for Microsoft Dynamics 365 (MSX)")
  .version("0.1.0");

registerAuthCommands(program);
registerMilestoneCommands(program);
registerOpportunityCommands(program);
registerEarningsCommand(program);
registerQueryCommand(program);

program.parse();
