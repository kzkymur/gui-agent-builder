// Minimal, dependency-free OpenAPI 3.x client helper
// Scope: build URLs (servers, path templating), attach query/body/headers,
// and basic security (apiKey in header/query, http bearer).

export type HttpMethod = 'get'|'post'|'put'|'patch'|'delete'|'options'|'head'|'trace';

export type OpenAPISpec = {
  openapi?: string;
  info?: { title?: string; version?: string };
  servers?: { url: string }[];
  paths: Record<string, Partial<Record<HttpMethod, OpenAPIOperation>>>;
  components?: {
    securitySchemes?: Record<string, SecurityScheme>;
  };
  security?: SecurityRequirement[];
};

export type OpenAPIOperation = {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in: 'path'|'query'|'header'|'cookie';
    required?: boolean;
  }>;
  requestBody?: any; // left generic; caller passes already-formed body
  responses?: any;
  security?: SecurityRequirement[];
};

type SecurityScheme =
  | { type: 'apiKey'; name: string; in: 'header'|'query'|'cookie' }
  | { type: 'http'; scheme: 'bearer'|'basic'; bearerFormat?: string };

type SecurityRequirement = Record<string, string[]>; // schemeName -> scopes (unused for apiKey/bearer here)

export type ClientAuth = {
  apiKey?: Record<string, string>; // schemeName -> key string
  bearer?: Record<string, string>; // schemeName -> token string (no "Bearer " prefix needed)
};

export type CallOptions = {
  serverUrl?: string;
  pathParams?: Record<string, string|number>;
  query?: Record<string, string|number|boolean|Array<string|number|boolean>|undefined>;
  headers?: Record<string, string>;
  body?: any;
  signal?: AbortSignal;
};

export type OpenAPIClient = {
  listOperations(): Array<{ operationId?: string; method: HttpMethod; path: string }>;
  callById(operationId: string, opts?: CallOptions): Promise<Response>;
  call(method: HttpMethod, path: string, opts?: CallOptions): Promise<Response>;
};

export function createClient(spec: OpenAPISpec, auth?: ClientAuth, fetchImpl: typeof fetch = fetch): OpenAPIClient {
  const serverUrl = (spec.servers && spec.servers[0]?.url) || '';

  const opIndex = new Map<string, { method: HttpMethod; path: string }>();
  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const method of Object.keys(methods) as HttpMethod[]) {
      const op = (methods as any)[method] as OpenAPIOperation;
      if (op?.operationId) opIndex.set(op.operationId, { method, path });
    }
  }

  function listOperations() {
    const out: Array<{ operationId?: string; method: HttpMethod; path: string }> = [];
    for (const [path, methods] of Object.entries(spec.paths || {})) {
      for (const method of Object.keys(methods) as HttpMethod[]) {
        const op = (methods as any)[method] as OpenAPIOperation;
        out.push({ operationId: op?.operationId, method, path });
      }
    }
    return out;
  }

  function applySecurityHeaders(method: HttpMethod, path: string, headers: Record<string,string>, url: URL) {
    const op = (spec.paths?.[path] as any)?.[method] as OpenAPIOperation | undefined;
    const requirements = op?.security ?? spec.security ?? [];
    const schemes = spec.components?.securitySchemes || {};
    for (const req of requirements) {
      for (const schemeName of Object.keys(req)) {
        const scheme = schemes[schemeName] as SecurityScheme | undefined;
        if (!scheme) continue;
        if (scheme.type === 'apiKey') {
          const key = auth?.apiKey?.[schemeName];
          if (!key) continue;
          if (scheme.in === 'header') headers[scheme.name] = key;
          else if (scheme.in === 'query') url.searchParams.set(scheme.name, key);
          // cookie not supported here
        } else if (scheme.type === 'http' && scheme.scheme === 'bearer') {
          const token = auth?.bearer?.[schemeName];
          if (!token) continue;
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
    }
  }

  function buildUrl(base: string, path: string, pathParams?: Record<string, any>, query?: CallOptions['query']): URL {
    let full = (base || '').replace(/\/$/, '') + path; // ensure single slash
    if (pathParams) {
      for (const [k, v] of Object.entries(pathParams)) {
        full = full.replace(new RegExp(`{${k}}`, 'g'), encodeURIComponent(String(v)));
      }
    }
    const url = new URL(full, typeof location !== 'undefined' ? location.origin : undefined);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined) continue;
        if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, String(item)));
        else url.searchParams.set(k, String(v));
      }
    }
    return url;
  }

  async function doCall(method: HttpMethod, path: string, opts: CallOptions = {}) {
    const base = opts.serverUrl ?? serverUrl;
    const url = buildUrl(base, path, opts.pathParams, opts.query);
    const headers: Record<string,string> = { 'accept': 'application/json', ...(opts.headers || {}) };
    applySecurityHeaders(method, path, headers, url);
    const body = opts.body === undefined || opts.body === null
      ? undefined
      : (typeof opts.body === 'string' || opts.body instanceof Blob)
        ? opts.body
        : JSON.stringify(opts.body);
    if (body && typeof body === 'string' && !('content-type' in Object.keys(headers).reduce((a,k)=>({ ...a, [k.toLowerCase()]: headers[k]}), {} as any))) {
      headers['content-type'] = 'application/json';
    }
    return fetchImpl(url.toString(), { method: method.toUpperCase(), headers, body, signal: opts.signal });
  }

  async function callById(operationId: string, opts?: CallOptions) {
    const found = opIndex.get(operationId);
    if (!found) throw new Error(`operationId not found: ${operationId}`);
    return doCall(found.method, found.path, opts);
  }

  async function call(method: HttpMethod, path: string, opts?: CallOptions) {
    return doCall(method, path, opts);
  }

  return { listOperations, callById, call };
}

