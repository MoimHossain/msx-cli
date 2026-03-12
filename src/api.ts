import { getToken } from "./auth.js";
import { getApiUrl } from "./config.js";

// ─── Core HTTP helpers ───────────────────────────────────────────────

interface ODataResponse<T> {
  "@odata.context"?: string;
  "@odata.count"?: number;
  "@odata.nextLink"?: string;
  value: T[];
}

async function crmHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0",
    Prefer: 'odata.include-annotations="*"',
  };
}

async function crmFetch<T>(entityPath: string): Promise<ODataResponse<T>> {
  const response = await fetch(getApiUrl(entityPath), { headers: await crmHeaders() });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`CRM API error ${response.status}: ${body}`);
  }
  return response.json() as Promise<ODataResponse<T>>;
}

async function crmFetchSingle<T>(entityPath: string): Promise<T> {
  const response = await fetch(getApiUrl(entityPath), { headers: await crmHeaders() });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`CRM API error ${response.status}: ${body}`);
  }
  return response.json() as Promise<T>;
}

async function crmPatch(entityPath: string, body: Record<string, unknown>): Promise<void> {
  const headers = await crmHeaders();
  headers["Content-Type"] = "application/json";
  const response = await fetch(getApiUrl(entityPath), {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`CRM PATCH error ${response.status}: ${text}`);
  }
}

async function crmPost<T>(entityPath: string, body: Record<string, unknown>): Promise<T> {
  const headers = await crmHeaders();
  headers["Content-Type"] = "application/json";
  headers["Prefer"] = "return=representation";
  const response = await fetch(getApiUrl(entityPath), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`CRM POST error ${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

// ─── WhoAmI ──────────────────────────────────────────────────────────

interface WhoAmIResponse {
  UserId: string;
  BusinessUnitId: string;
  OrganizationId: string;
}

let cachedUserId: string | null = null;

export async function getMyUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const data = await crmFetchSingle<WhoAmIResponse>("WhoAmI");
  cachedUserId = data.UserId;
  return cachedUserId;
}

// ─── User lookup ─────────────────────────────────────────────────────

export interface SystemUser {
  systemuserid: string;
  fullname: string;
  internalemailaddress: string;
  domainname?: string;
  title?: string;
}

export async function lookupUserByEmail(email: string): Promise<SystemUser | null> {
  const lower = email.toLowerCase();
  // Try exact match on internalemailaddress first, then domainname (alias)
  let result = await crmFetch<SystemUser>(
    `systemusers?$select=systemuserid,fullname,internalemailaddress,domainname,title&$filter=internalemailaddress eq '${email}'&$top=1`
  );
  if (result.value.length > 0) return result.value[0];

  // Try domainname (e.g. mohossa@microsoft.com)
  result = await crmFetch<SystemUser>(
    `systemusers?$select=systemuserid,fullname,internalemailaddress,domainname,title&$filter=domainname eq '${email}'&$top=1`
  );
  if (result.value.length > 0) return result.value[0];

  // Partial/contains match as fallback (handles alias without domain)
  const alias = lower.split("@")[0];
  result = await crmFetch<SystemUser>(
    `systemusers?$select=systemuserid,fullname,internalemailaddress,domainname,title&$filter=contains(domainname,'${alias}')&$top=5`
  );
  if (result.value.length === 1) return result.value[0];
  if (result.value.length > 1) {
    // Try to find exact alias match
    const exact = result.value.find(u =>
      u.domainname?.toLowerCase() === lower ||
      u.internalemailaddress?.toLowerCase() === lower
    );
    if (exact) return exact;
    return result.value[0];
  }

  return null;
}

export async function searchUsers(term: string, top: number = 10): Promise<SystemUser[]> {
  const result = await crmFetch<SystemUser>(
    `systemusers?$select=systemuserid,fullname,internalemailaddress,title&$filter=contains(fullname,'${term}') or contains(internalemailaddress,'${term}')&$top=${top}`
  );
  return result.value;
}

// ─── Shared field lists ──────────────────────────────────────────────

const OPPORTUNITY_FIELDS = [
  "opportunityid", "name", "estimatedvalue", "estimatedclosedate",
  "stepname", "statuscode", "statecode", "createdon", "modifiedon",
  "description", "actualvalue", "actualclosedate",
  "budgetamount", "currentsituation", "customerneed", "proposedsolution",
  "_parentaccountid_value", "_parentcontactid_value", "_ownerid_value",
];

const OPPORTUNITY_SELECT = OPPORTUNITY_FIELDS.join(",");

// ─── Opportunity types ───────────────────────────────────────────────

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
  actualvalue?: number;
  "actualvalue@OData.Community.Display.V1.FormattedValue"?: string;
  actualclosedate?: string;
  budgetamount?: number;
  "budgetamount@OData.Community.Display.V1.FormattedValue"?: string;
  currentsituation?: string;
  customerneed?: string;
  proposedsolution?: string;
  _parentaccountid_value?: string;
  "_parentaccountid_value@OData.Community.Display.V1.FormattedValue"?: string;
  _parentcontactid_value?: string;
  "_parentcontactid_value@OData.Community.Display.V1.FormattedValue"?: string;
  _ownerid_value?: string;
  "_ownerid_value@OData.Community.Display.V1.FormattedValue"?: string;
  [key: string]: unknown;
}

// ─── Milestone types (msp_engagementmilestone) ───────────────────────

const MILESTONE_FIELDS = [
  "msp_engagementmilestoneid", "msp_milestonenumber", "msp_name",
  "msp_milestonedate", "msp_milestonestatus", "msp_milestonestatusreason",
  "msp_milestonecategory", "msp_milestoneworkload", "msp_milestonesolutionarea",
  "msp_completed", "msp_completedon", "msp_commitmentrecommendation",
  "msp_forecastcomments", "msp_milestonecomments",
  "msp_monthlyuse", "msp_noofactivations", "msp_seatsentitlements",
  "msp_bacvrate", "msp_helpneeded", "msp_nonrecurring",
  "msp_uatmilestoneowner", "msp_uataccountname", "msp_uatarea",
  "msp_uatentityname", "msp_uatentitynumber",
  "_ownerid_value", "_msp_opportunityid_value", "_msp_engagementid_value",
  "statecode", "statuscode", "createdon", "modifiedon",
];

const MILESTONE_SELECT = MILESTONE_FIELDS.join(",");

export interface Milestone {
  msp_engagementmilestoneid: string;
  msp_milestonenumber?: string;
  msp_name?: string;
  msp_milestonedate?: string;
  msp_milestonestatus?: number;
  "msp_milestonestatus@OData.Community.Display.V1.FormattedValue"?: string;
  msp_milestonestatusreason?: number;
  "msp_milestonestatusreason@OData.Community.Display.V1.FormattedValue"?: string;
  msp_milestonecategory?: number;
  "msp_milestonecategory@OData.Community.Display.V1.FormattedValue"?: string;
  msp_milestoneworkload?: number;
  "msp_milestoneworkload@OData.Community.Display.V1.FormattedValue"?: string;
  msp_milestonesolutionarea?: number;
  "msp_milestonesolutionarea@OData.Community.Display.V1.FormattedValue"?: string;
  msp_completed?: number;
  "msp_completed@OData.Community.Display.V1.FormattedValue"?: string;
  msp_completedon?: string;
  msp_commitmentrecommendation?: number;
  "msp_commitmentrecommendation@OData.Community.Display.V1.FormattedValue"?: string;
  msp_forecastcomments?: string;
  msp_milestonecomments?: string;
  msp_monthlyuse?: number;
  "msp_monthlyuse@OData.Community.Display.V1.FormattedValue"?: string;
  msp_noofactivations?: number;
  msp_seatsentitlements?: number;
  msp_bacvrate?: number;
  msp_helpneeded?: number;
  "msp_helpneeded@OData.Community.Display.V1.FormattedValue"?: string;
  msp_nonrecurring?: number;
  "msp_nonrecurring@OData.Community.Display.V1.FormattedValue"?: string;
  msp_uatmilestoneowner?: string;
  msp_uataccountname?: string;
  msp_uatarea?: string;
  msp_uatentityname?: string;
  msp_uatentitynumber?: string;
  _ownerid_value?: string;
  "_ownerid_value@OData.Community.Display.V1.FormattedValue"?: string;
  _msp_opportunityid_value?: string;
  "_msp_opportunityid_value@OData.Community.Display.V1.FormattedValue"?: string;
  _msp_engagementid_value?: string;
  statecode?: number;
  statuscode?: number;
  createdon?: string;
  modifiedon?: string;
  [key: string]: unknown;
}

// ─── Milestone API (msp_engagementmilestones) ────────────────────────

export interface MilestoneFilters {
  userId?: string;
  name?: string;
  milestoneNumber?: string;
  dateBefore?: string;
  dateAfter?: string;
  activeOnly?: boolean;
  status?: number;
  top?: number;
  select?: string;
}

export async function listMilestones(filters: MilestoneFilters = {}): Promise<Milestone[]> {
  const conditions: string[] = [];
  if (filters.activeOnly !== false) conditions.push("statecode eq 0");
  if (filters.userId) conditions.push(`_ownerid_value eq '${filters.userId}'`);
  if (filters.name) conditions.push(`contains(msp_name,'${filters.name}')`);
  if (filters.milestoneNumber) conditions.push(`msp_milestonenumber eq '${filters.milestoneNumber}'`);
  if (filters.dateBefore) conditions.push(`msp_milestonedate le ${filters.dateBefore}`);
  if (filters.dateAfter) conditions.push(`msp_milestonedate ge ${filters.dateAfter}`);
  if (filters.status != null) conditions.push(`msp_milestonestatus eq ${filters.status}`);

  const filter = conditions.length > 0 ? `&$filter=${conditions.join(" and ")}` : "";
  const top = filters.top ?? 50;
  const select = filters.select ?? MILESTONE_SELECT;

  const result = await crmFetch<Milestone>(
    `msp_engagementmilestones?$select=${select}${filter}&$top=${top}&$orderby=msp_milestonedate desc`
  );
  return result.value;
}

export async function getMilestoneByNumber(milestoneNumber: string): Promise<Milestone | null> {
  const result = await crmFetch<Milestone>(
    `msp_engagementmilestones?$select=${MILESTONE_SELECT}&$filter=msp_milestonenumber eq '${milestoneNumber}'&$top=1`
  );
  return result.value.length > 0 ? result.value[0] : null;
}

export async function getMilestone(id: string): Promise<Milestone> {
  return crmFetchSingle<Milestone>(
    `msp_engagementmilestones(${id})?$select=${MILESTONE_SELECT}`
  );
}

export async function updateMilestone(id: string, fields: Record<string, unknown>): Promise<void> {
  await crmPatch(`msp_engagementmilestones(${id})`, fields);
}

export async function createMilestone(fields: Record<string, unknown>): Promise<Milestone> {
  return crmPost<Milestone>("msp_engagementmilestones", fields);
}

// ─── Opportunity API ─────────────────────────────────────────────────

export async function listOpportunities(opts: {
  active?: boolean;
  top?: number;
  select?: string;
} = {}): Promise<Opportunity[]> {
  const filter = opts.active ? "&$filter=statecode eq 0" : "";
  const top = opts.top ?? 20;
  const select = opts.select ?? OPPORTUNITY_SELECT;
  const result = await crmFetch<Opportunity>(
    `opportunities?$select=${select}${filter}&$top=${top}&$orderby=modifiedon desc`
  );
  return result.value;
}

export async function getOpportunity(id: string): Promise<Opportunity> {
  return crmFetchSingle<Opportunity>(
    `opportunities(${id})?$select=${OPPORTUNITY_SELECT}`
  );
}

export async function searchOpportunities(term: string, top: number = 20, select?: string): Promise<Opportunity[]> {
  const sel = select ?? OPPORTUNITY_SELECT;
  const result = await crmFetch<Opportunity>(
    `opportunities?$select=${sel}&$filter=contains(name,'${term}')&$top=${top}&$orderby=modifiedon desc`
  );
  return result.value;
}

export async function updateOpportunity(id: string, fields: Record<string, unknown>): Promise<void> {
  await crmPatch(`opportunities(${id})`, fields);
}

// ─── Earnings (won opportunities = closed revenue) ───────────────────

export interface EarningsSummary {
  totalWon: number;
  count: number;
  opportunities: Opportunity[];
}

export async function getEarnings(opts: {
  userId?: string;
  year?: number;
} = {}): Promise<EarningsSummary> {
  const conditions: string[] = ["statecode eq 1", "statuscode eq 3"]; // Won
  if (opts.userId) conditions.push(`_ownerid_value eq '${opts.userId}'`);
  if (opts.year) {
    conditions.push(`actualclosedate ge ${opts.year}-01-01`);
    conditions.push(`actualclosedate le ${opts.year}-12-31`);
  }
  const filter = conditions.join(" and ");
  const select = "opportunityid,name,actualvalue,actualclosedate,_parentaccountid_value,_ownerid_value,stepname";

  const result = await crmFetch<Opportunity>(
    `opportunities?$select=${select}&$filter=${filter}&$orderby=actualclosedate desc&$top=100`
  );
  const totalWon = result.value.reduce((sum, o) => sum + (o.actualvalue ?? 0), 0);
  return { totalWon, count: result.value.length, opportunities: result.value };
}

// ─── Entity metadata / schema ────────────────────────────────────────

export interface EntityAttribute {
  LogicalName: string;
  DisplayName: { UserLocalizedLabel?: { Label: string } };
  AttributeType: string;
  Description?: { UserLocalizedLabel?: { Label: string } };
  IsValidForRead?: boolean;
  IsValidForCreate?: boolean;
  IsValidForUpdate?: boolean;
  RequiredLevel?: { Value: string };
  MaxLength?: number;
  MinValue?: number;
  MaxValue?: number;
  Precision?: number;
}

export interface SchemaField {
  name: string;
  displayName: string;
  type: string;
  description: string;
  readable: boolean;
  creatable: boolean;
  updatable: boolean;
  required: string;
}

export async function getEntitySchema(entityLogicalName: string): Promise<SchemaField[]> {
  const response = await fetch(
    getApiUrl(`EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes?$select=LogicalName,DisplayName,AttributeType,Description,IsValidForRead,IsValidForCreate,IsValidForUpdate,RequiredLevel`),
    { headers: await crmHeaders() }
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Metadata API error ${response.status}: ${body}`);
  }
  const data = await response.json() as ODataResponse<EntityAttribute>;
  return data.value
    .filter(a => a.IsValidForRead !== false)
    .map(a => ({
      name: a.LogicalName,
      displayName: a.DisplayName?.UserLocalizedLabel?.Label ?? "",
      type: a.AttributeType,
      description: a.Description?.UserLocalizedLabel?.Label ?? "",
      readable: a.IsValidForRead ?? true,
      creatable: a.IsValidForCreate ?? false,
      updatable: a.IsValidForUpdate ?? false,
      required: a.RequiredLevel?.Value ?? "None",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Flexible select builder ─────────────────────────────────────────

export function buildSelect(customFields: string | undefined, defaultFields: string): string {
  if (!customFields) return defaultFields;
  return customFields.split(",").map(f => f.trim()).join(",");
}

// ─── Picklist / OptionSet metadata ───────────────────────────────────

export interface PicklistOption {
  value: number;
  label: string;
  description: string;
}

export async function getPicklistOptions(
  entityLogicalName: string,
  attributeLogicalName: string,
): Promise<PicklistOption[]> {
  const response = await fetch(
    getApiUrl(
      `EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${attributeLogicalName}')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$expand=OptionSet`
    ),
    { headers: await crmHeaders() },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OptionSet API error ${response.status}: ${body}`);
  }
  const data = await response.json() as {
    OptionSet?: {
      Options?: Array<{
        Value: number;
        Label?: { UserLocalizedLabel?: { Label: string } };
        Description?: { UserLocalizedLabel?: { Label: string } };
      }>;
    };
  };
  return (data.OptionSet?.Options ?? []).map(o => ({
    value: o.Value,
    label: o.Label?.UserLocalizedLabel?.Label ?? String(o.Value),
    description: o.Description?.UserLocalizedLabel?.Label ?? "",
  }));
}

// Resolve a status label to its numeric value for msp_milestonestatus
export async function resolveMilestoneStatusValue(label: string): Promise<number | null> {
  const options = await getPicklistOptions("msp_engagementmilestone", "msp_milestonestatus");
  const lower = label.toLowerCase();
  const match = options.find(
    o => o.label.toLowerCase() === lower || o.label.toLowerCase().includes(lower)
  );
  return match?.value ?? null;
}

// ─── Generic entity query (for exploration) ──────────────────────────

export async function queryEntity(entity: string, query: string = ""): Promise<unknown[]> {
  const path = query ? `${entity}?${query}` : entity;
  const result = await crmFetch<unknown>(path);
  return result.value;
}
