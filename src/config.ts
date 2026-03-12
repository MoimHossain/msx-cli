export const MSX_CONFIG = {
  // Well-known first-party Dynamics 365 client ID (no app registration needed)
  clientId: "2ad88395-b77d-4561-9441-d0e40824f9bc",
  authority: "https://login.microsoftonline.com/organizations",
  redirectUri: "app://5d3e90d6-aa8e-48a8-8f2c-58b45cc67315",

  // MSX (Microsoft Sales) Dynamics 365 instance
  crmBaseUrl: "https://microsoftsales.crm.dynamics.com",
  apiPath: "/api/data/v9.2",

  scopes: ["https://microsoftsales.crm.dynamics.com/.default"] as string[],
} as const;

export function getApiUrl(entityPath: string): string {
  return `${MSX_CONFIG.crmBaseUrl}${MSX_CONFIG.apiPath}/${entityPath}`;
}
