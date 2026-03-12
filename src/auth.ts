import { PublicClientApplication, AuthenticationResult, TokenCacheContext, LogLevel } from "@azure/msal-node";
import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { MSX_CONFIG } from "./config.js";

const CACHE_DIR = path.join(os.homedir(), ".msx-cli");
const CACHE_FILE = path.join(CACHE_DIR, "token-cache.json");

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function loadCache(): string | undefined {
  ensureCacheDir();
  if (fs.existsSync(CACHE_FILE)) {
    return fs.readFileSync(CACHE_FILE, "utf-8");
  }
  return undefined;
}

function saveCache(cache: string): void {
  ensureCacheDir();
  fs.writeFileSync(CACHE_FILE, cache, "utf-8");
}

function openBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // On Windows, use 'start' to open the default browser
    exec(`start "" "${url}"`, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function createMsalClient(): PublicClientApplication {
  const pca = new PublicClientApplication({
    auth: {
      clientId: MSX_CONFIG.clientId,
      authority: MSX_CONFIG.authority,
    },
    cache: {
      cachePlugin: {
        beforeCacheAccess: async (context: TokenCacheContext) => {
          const data = loadCache();
          if (data) {
            context.tokenCache.deserialize(data);
          }
        },
        afterCacheAccess: async (context: TokenCacheContext) => {
          if (context.cacheHasChanged) {
            saveCache(context.tokenCache.serialize());
          }
        },
      },
    },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Warning,
      },
    },
  });

  return pca;
}

/**
 * Interactive browser login — opens the system browser which carries the
 * device's PRT (Primary Refresh Token), satisfying Conditional Access
 * policies that require managed/compliant devices.
 */
export async function login(): Promise<AuthenticationResult> {
  const pca = createMsalClient();

  console.log("🌐 Opening your browser for sign-in...");
  console.log("   (Your device compliance claims will be included automatically)");
  console.log();

  const result = await pca.acquireTokenInteractive({
    scopes: MSX_CONFIG.scopes,
    openBrowser: async (url) => {
      await openBrowser(url);
    },
    successTemplate:
      `<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0d1117;color:#c9d1d9">` +
      `<div style="text-align:center"><h1 style="color:#3fb950">✅ Signed in to MSX CLI</h1><p>You can close this window and return to the terminal.</p></div>` +
      `</body></html>`,
    errorTemplate:
      `<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0d1117;color:#c9d1d9">` +
      `<div style="text-align:center"><h1 style="color:#f85149">❌ Sign-in failed</h1><p>{{error}}</p></div>` +
      `</body></html>`,
  });

  if (!result) {
    throw new Error("Authentication failed — no result returned.");
  }
  return result;
}

export async function getToken(): Promise<string> {
  const pca = createMsalClient();
  const accounts = await pca.getTokenCache().getAllAccounts();

  if (accounts.length === 0) {
    throw new Error("Not logged in. Run `msx-cli login` first.");
  }

  try {
    const silentResult = await pca.acquireTokenSilent({
      scopes: MSX_CONFIG.scopes,
      account: accounts[0],
    });
    return silentResult.accessToken;
  } catch {
    // Silent acquisition failed — re-authenticate interactively
    console.log("⚠️  Session expired. Re-authenticating...");
    const result = await login();
    return result.accessToken;
  }
}

export async function logout(): Promise<void> {
  if (fs.existsSync(CACHE_FILE)) {
    fs.unlinkSync(CACHE_FILE);
  }
}

export async function getAccountInfo(): Promise<{ username: string; name: string } | null> {
  const pca = createMsalClient();
  const accounts = await pca.getTokenCache().getAllAccounts();
  if (accounts.length === 0) return null;
  return {
    username: accounts[0].username,
    name: accounts[0].name ?? accounts[0].username,
  };
}
