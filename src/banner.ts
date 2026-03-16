import chalk from "chalk";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getVersion(): string {
  const pkgPath = join(__dirname, "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  return pkg.version;
}

export function printBanner(): void {
  const version = getVersion();

  const taglines = [
    "Closing deals from the terminal — GUIs are for amateurs 💅",
    "Your pipeline called. It wants attention 📞",
    "Hotter than your Q4 forecast 🔥",
    "Swipe right on every opportunity 💘",
    "Who needs Dynamics UI when you have keystrokes? ⌨️",
    "Making CRM sexy, one command at a time 💋",
    "Quota crushers don't click, they type 🏆",
    "Relationship management at 120 WPM 💨",
  ];
  const tagline = taglines[Math.floor(Math.random() * taglines.length)];

  // A little suited-up sales figure
  const figure = [
    chalk.hex('#FFC857')('        ╭━━━╮       '),
    chalk.hex('#FFC857')('        ┃ ◕‿◕┃       '),
    chalk.hex('#FFC857')('        ╰┳━━┳╯       '),
    chalk.hex('#FF8E53')('       ╭─┻────┻─╮    '),
    chalk.hex('#FF8E53')('       │  ╔══╗  │    '),
    chalk.hex('#FF8E53')('       │  ║$$║  │    '),
    chalk.hex('#FF8E53')('       │  ╚══╝  │    '),
    chalk.hex('#FF6B6B')('       ╰─┬────┬─╯    '),
    chalk.hex('#FF6B6B')('         │    │       '),
    chalk.hex('#FF6B6B')('        ─┘    └─      '),
  ];

  const crmArt = [
    `${chalk.hex('#FF6B6B')(' ██████╗ ')}${chalk.hex('#FF8E53')('██████╗ ')}${chalk.hex('#FFC857')('███╗   ███╗')}`,
    `${chalk.hex('#FF6B6B')('██╔════╝ ')}${chalk.hex('#FF8E53')('██╔══██╗')}${chalk.hex('#FFC857')('████╗ ████║')}`,
    `${chalk.hex('#FF6B6B')('██║      ')}${chalk.hex('#FF8E53')('██████╔╝')}${chalk.hex('#FFC857')('██╔████╔██║')}`,
    `${chalk.hex('#FF6B6B')('██║      ')}${chalk.hex('#FF8E53')('██╔══██╗')}${chalk.hex('#FFC857')('██║╚██╔╝██║')}`,
    `${chalk.hex('#FF6B6B')('╚██████╗ ')}${chalk.hex('#FF8E53')('██║  ██║')}${chalk.hex('#FFC857')('██║ ╚═╝ ██║')}`,
    `${chalk.hex('#FF6B6B')(' ╚═════╝ ')}${chalk.hex('#FF8E53')('╚═╝  ╚═╝')}${chalk.hex('#FFC857')('╚═╝     ╚═╝')}`,
  ];

  // Merge the CRM art and the figure side by side
  const maxLines = Math.max(crmArt.length, figure.length);
  const merged: string[] = [];
  for (let i = 0; i < maxLines; i++) {
    const left = i < crmArt.length ? crmArt[i] : ' '.repeat(30);
    const right = i < figure.length ? figure[i] : '';
    merged.push(`  ${left}  ${right}`);
  }

  const banner = `
${merged.join('\n')}

  ${chalk.bold.white('CRM CLI')} ${chalk.dim(`v${version}`)}  ${chalk.magenta('♥')}  ${chalk.italic.gray('AI-powered Dynamics 365 from your terminal')}
  ${chalk.dim('─'.repeat(60))}
  ${chalk.italic.hex('#FF8E53')(tagline)}
`;

  console.log(banner);
}
