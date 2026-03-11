import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KuratchiAPI } from "./api";

type Env = {};

function createAPI(apiKey: string): KuratchiAPI {
  if (!apiKey) {
    throw new Error("Not authenticated. Provide a platform API token (kdbp_) via Authorization: Bearer header.");
  }

  return new KuratchiAPI(apiKey);
}

function registerTools(server: McpServer, apiKey: string) {
  server.registerTool(
    "health",
    {
      description: "Check Kuratchi platform status",
      inputSchema: {},
    },
    async () => {
      const result = await createAPI(apiKey).health();
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "list_databases",
    {
      description: "List all databases in your organization",
      inputSchema: {},
    },
    async () => {
      const result = await createAPI(apiKey).listDatabases();
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "create_database",
    {
      description: "Create a new database",
      inputSchema: {
        name: z.string().describe("Name for the new database"),
        locationHint: z.string().optional().describe("Region hint (e.g. 'wnam', 'enam', 'weur', 'eeur', 'apac')"),
      },
    },
    async ({ name, locationHint }) => {
      const result = await createAPI(apiKey).createDatabase(name, locationHint);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_database",
    {
      description: "Get details about a specific database",
      inputSchema: {
        id: z.string().describe("Database ID"),
      },
    },
    async ({ id }) => {
      const result = await createAPI(apiKey).getDatabase(id);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "delete_database",
    {
      description: "Delete a database permanently",
      inputSchema: {
        id: z.string().describe("Database ID to delete"),
      },
    },
    async ({ id }) => {
      const result = await createAPI(apiKey).deleteDatabase(id);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "redeploy_database",
    {
      description: "Redeploy a database after configuration changes",
      inputSchema: {
        id: z.string().describe("Database ID to redeploy"),
      },
    },
    async ({ id }) => {
      const result = await createAPI(apiKey).redeployDatabase(id);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "query_database",
    {
      description: "Execute a SQL query against a database using a scoped token",
      inputSchema: {
        dbName: z.string().describe("Database name"),
        sql: z.string().describe("SQL query to execute"),
        token: z.string().describe("Scoped database token"),
      },
    },
    async ({ dbName, sql, token }) => {
      const result = await createAPI(apiKey).queryDatabase(dbName, sql, token);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "list_kv_namespaces",
    {
      description: "List all KV namespaces in your organization",
      inputSchema: {},
    },
    async () => {
      const result = await createAPI(apiKey).listKVNamespaces();
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "create_kv_namespace",
    {
      description: "Create a new KV namespace",
      inputSchema: {
        name: z.string().describe("Name for the new KV namespace"),
      },
    },
    async ({ name }) => {
      const result = await createAPI(apiKey).createKVNamespace(name);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_kv_namespace",
    {
      description: "Get details about a specific KV namespace",
      inputSchema: {
        id: z.string().describe("KV namespace ID"),
      },
    },
    async ({ id }) => {
      const result = await createAPI(apiKey).getKVNamespace(id);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "delete_kv_namespace",
    {
      description: "Delete a KV namespace permanently",
      inputSchema: {
        id: z.string().describe("KV namespace ID to delete"),
      },
    },
    async ({ id }) => {
      const result = await createAPI(apiKey).deleteKVNamespace(id);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "list_r2_buckets",
    {
      description: "List all R2 buckets in your organization",
      inputSchema: {},
    },
    async () => {
      const result = await createAPI(apiKey).listR2Buckets();
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "create_r2_bucket",
    {
      description: "Create a new R2 storage bucket",
      inputSchema: {
        name: z.string().describe("Name for the new R2 bucket"),
        locationHint: z.string().optional().describe("Region hint (e.g. 'wnam', 'enam', 'weur', 'eeur', 'apac')"),
      },
    },
    async ({ name, locationHint }) => {
      const result = await createAPI(apiKey).createR2Bucket(name, locationHint);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_r2_bucket",
    {
      description: "Get details about a specific R2 bucket",
      inputSchema: {
        id: z.string().describe("R2 bucket ID"),
      },
    },
    async ({ id }) => {
      const result = await createAPI(apiKey).getR2Bucket(id);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "delete_r2_bucket",
    {
      description: "Delete an R2 bucket permanently",
      inputSchema: {
        id: z.string().describe("R2 bucket ID to delete"),
      },
    },
    async ({ id }) => {
      const result = await createAPI(apiKey).deleteR2Bucket(id);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "create_token",
    {
      description: "Create a scoped API token for a specific resource (database, KV, or R2)",
      inputSchema: {
        type: z.enum(["database", "kv", "r2"]).describe("Resource type to scope the token to"),
        name: z.string().describe("Name for the token"),
        databaseId: z.string().optional().describe("Database ID (required if type is 'database')"),
        kvNamespaceId: z.string().optional().describe("KV namespace ID (required if type is 'kv')"),
        r2BucketId: z.string().optional().describe("R2 bucket ID (required if type is 'r2')"),
      },
    },
    async (params) => {
      const result = await createAPI(apiKey).createToken(params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "revoke_token",
    {
      description: "Revoke a scoped API token",
      inputSchema: {
        tokenId: z.string().describe("Token ID to revoke"),
      },
    },
    async ({ tokenId }) => {
      const result = await createAPI(apiKey).revokeToken(tokenId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}

function createServer(apiKey: string) {
  const server = new McpServer({
    name: "Kuratchi",
    version: "0.0.1",
  });

  registerTools(server, apiKey);

  return server;
}

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      const apiKey = extractBearerToken(request) || "";
      const server = createServer(apiKey);
      return createMcpHandler(server, { route: "/mcp" })(request, env, ctx);
    }

    if (url.pathname === "/") {
      return new Response(
        JSON.stringify(
          {
            name: "Kuratchi MCP Server",
            version: "0.0.1",
            auth: "Pass your platform API token (kdbp_) via Authorization: Bearer header",
            endpoint: "/mcp",
          },
          null,
          2
        ),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
