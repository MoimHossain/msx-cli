import { getToken } from "./auth.js";
import { getApiUrl } from "./config.js";

interface ODataResponse<T> {
  "@odata.context"?: string;
  "@odata.count"?: number;
  "@odata.nextLink"?: string;
  value: T[];
}

async function crmFetch<T>(entityPath: string): Promise<ODataResponse<T>> {
  const token = await getToken();
  const url = getApiUrl(entityPath);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
      Prefer: 'odata.include-annotations="*"',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`CRM API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<ODataResponse<T>>;
}

// --- Opportunities ---

export interface Opportunity {
  opportunityid: string;
  name: string;
  estimatedvalue?: number;
  "estimatedvalue@OData.Community.Display.V1.FormattedValue"?: string;
  estimatedclosedate?: string;
  stepname?: string;
  statuscode?: number;
  "statuscode@OData.Community.Display.V1.FormattedValue"?: string;
  statecode?: number;
  "statecode@OData.Community.Display.V1.FormattedValue"?: string;
  createdon?: string;
  modifiedon?: string;
  description?: string;
}

export async function listOpportunities(top: number = 20): Promise<Opportunity[]> {
  const select = [
    "opportunityid", "name", "estimatedvalue", "estimatedclosedate",
    "stepname", "statuscode", "statecode", "createdon", "modifiedon", "description"
  ].join(",");

  const result = await crmFetch<Opportunity>(
    `opportunities?$select=${select}&$top=${top}&$orderby=modifiedon desc`
  );
  return result.value;
}

export async function listActiveOpportunities(top: number = 20): Promise<Opportunity[]> {
  const select = [
    "opportunityid", "name", "estimatedvalue", "estimatedclosedate",
    "stepname", "statuscode", "statecode", "createdon", "modifiedon"
  ].join(",");

  const result = await crmFetch<Opportunity>(
    `opportunities?$select=${select}&$filter=statecode eq 0&$top=${top}&$orderby=modifiedon desc`
  );
  return result.value;
}

// --- WhoAmI (current user) ---

interface WhoAmIResponse {
  UserId: string;
  BusinessUnitId: string;
  OrganizationId: string;
}

let cachedUserId: string | null = null;

async function getMyUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const token = await getToken();
  const url = getApiUrl("WhoAmI");
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WhoAmI failed ${response.status}: ${body}`);
  }
  const data = (await response.json()) as WhoAmIResponse;
  cachedUserId = data.UserId;
  return cachedUserId;
}

// --- Milestones (my opportunities with their current stage) ---

export interface MyMilestone {
  opportunityid: string;
  name: string;
  stepname?: string;
  estimatedvalue?: number;
  "estimatedvalue@OData.Community.Display.V1.FormattedValue"?: string;
  estimatedclosedate?: string;
  statuscode?: number;
  "statuscode@OData.Community.Display.V1.FormattedValue"?: string;
  statecode?: number;
  "statecode@OData.Community.Display.V1.FormattedValue"?: string;
  modifiedon?: string;
}

export async function listMyMilestones(top: number = 50): Promise<MyMilestone[]> {
  const userId = await getMyUserId();
  const select = [
    "opportunityid", "name", "stepname", "estimatedvalue",
    "estimatedclosedate", "statuscode", "statecode", "modifiedon"
  ].join(",");

  const result = await crmFetch<MyMilestone>(
    `opportunities?$select=${select}&$filter=_ownerid_value eq '${userId}' and statecode eq 0&$top=${top}&$orderby=estimatedclosedate asc`
  );
  return result.value;
}

// --- Generic entity query (for exploration) ---

export async function queryEntity(entity: string, query: string = ""): Promise<unknown[]> {
  const path = query ? `${entity}?${query}` : entity;
  const result = await crmFetch<unknown>(path);
  return result.value;
}
