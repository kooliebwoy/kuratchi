import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KuratchiAPI } from "./api";

type Env = {};

type Props = {
  apiKey: string;
};

export class KuratchiMCP extends McpAgent<Env, unknown, Props> {
  server = new McpServer({
    name: "Kuratchi",
    version: "0.0.1",
  });

  private getAPI(): KuratchiAPI {
    if (!this.props.apiKey) {
      throw new Error("Not authenticated. Provide a platform API token (kdbp_) via the Authorization header.");
    }
    return new KuratchiAPI(this.props.apiKey);
  }

  async init() {
    // ── Health ──────────────────────────────────────────────

    this.server.tool("health", "Check Kuratchi platform status", {}, async () => {
      const api = this.getAPI();
      const result = await api.health();
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    });

    // ── Databases ──────────────────────────────────────────

    this.server.tool(
      "list_databases",
      "List all databases in your organization",
      {},
      async () => {
        const api = this.getAPI();
        const result = await api.listDatabases();
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "create_database",
      "Create a new database",
      {
        name: z.string().describe("Name for the new database"),
        locationHint: z.string().optional().describe("Region hint (e.g. 'wnam', 'enam', 'weur', 'eeur', 'apac')"),
      },
      async ({ name, locationHint }) => {
        const api = this.getAPI();
        const result = await api.createDatabase(name, locationHint);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "get_database",
      "Get details about a specific database",
      {
        id: z.string().describe("Database ID"),
      },
      async ({ id }) => {
        const api = this.getAPI();
        const result = await api.getDatabase(id);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "delete_database",
      "Delete a database permanently",
      {
        id: z.string().describe("Database ID to delete"),
      },
      async ({ id }) => {
        const api = this.getAPI();
        const result = await api.deleteDatabase(id);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "redeploy_database",
      "Redeploy a database after configuration changes",
      {
        id: z.string().describe("Database ID to redeploy"),
      },
      async ({ id }) => {
        const api = this.getAPI();
        const result = await api.redeployDatabase(id);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "query_database",
      "Execute a SQL query against a database using a scoped token",
      {
        dbName: z.string().describe("Database name"),
        sql: z.string().describe("SQL query to execute"),
        token: z.string().describe("Scoped database token"),
      },
      async ({ dbName, sql, token }) => {
        const api = this.getAPI();
        const result = await api.queryDatabase(dbName, sql, token);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    // ── KV Namespaces ──────────────────────────────────────

    this.server.tool(
      "list_kv_namespaces",
      "List all KV namespaces in your organization",
      {},
      async () => {
        const api = this.getAPI();
        const result = await api.listKVNamespaces();
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "create_kv_namespace",
      "Create a new KV namespace",
      {
        name: z.string().describe("Name for the new KV namespace"),
      },
      async ({ name }) => {
        const api = this.getAPI();
        const result = await api.createKVNamespace(name);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "get_kv_namespace",
      "Get details about a specific KV namespace",
      {
        id: z.string().describe("KV namespace ID"),
      },
      async ({ id }) => {
        const api = this.getAPI();
        const result = await api.getKVNamespace(id);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "delete_kv_namespace",
      "Delete a KV namespace permanently",
      {
        id: z.string().describe("KV namespace ID to delete"),
      },
      async ({ id }) => {
        const api = this.getAPI();
        const result = await api.deleteKVNamespace(id);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    // ── R2 Buckets ─────────────────────────────────────────

    this.server.tool(
      "list_r2_buckets",
      "List all R2 buckets in your organization",
      {},
      async () => {
        const api = this.getAPI();
        const result = await api.listR2Buckets();
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "create_r2_bucket",
      "Create a new R2 storage bucket",
      {
        name: z.string().describe("Name for the new R2 bucket"),
        locationHint: z.string().optional().describe("Region hint (e.g. 'wnam', 'enam', 'weur', 'eeur', 'apac')"),
      },
      async ({ name, locationHint }) => {
        const api = this.getAPI();
        const result = await api.createR2Bucket(name, locationHint);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "get_r2_bucket",
      "Get details about a specific R2 bucket",
      {
        id: z.string().describe("R2 bucket ID"),
      },
      async ({ id }) => {
        const api = this.getAPI();
        const result = await api.getR2Bucket(id);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "delete_r2_bucket",
      "Delete an R2 bucket permanently",
      {
        id: z.string().describe("R2 bucket ID to delete"),
      },
      async ({ id }) => {
        const api = this.getAPI();
        const result = await api.deleteR2Bucket(id);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    // ── Tokens ─────────────────────────────────────────────

    this.server.tool(
      "create_token",
      "Create a scoped API token for a specific resource (database, KV, or R2)",
      {
        type: z.enum(["database", "kv", "r2"]).describe("Resource type to scope the token to"),
        name: z.string().describe("Name for the token"),
        databaseId: z.string().optional().describe("Database ID (required if type is 'database')"),
        kvNamespaceId: z.string().optional().describe("KV namespace ID (required if type is 'kv')"),
        r2BucketId: z.string().optional().describe("R2 bucket ID (required if type is 'r2')"),
      },
      async (params) => {
        const api = this.getAPI();
        const result = await api.createToken(params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "revoke_token",
      "Revoke a scoped API token",
      {
        tokenId: z.string().describe("Token ID to revoke"),
      },
      async ({ tokenId }) => {
        const api = this.getAPI();
        const result = await api.revokeToken(tokenId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );
  }
}

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const apiKey = extractBearerToken(request) || "";

    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return KuratchiMCP.serveSSE("/sse", { props: { apiKey } }).fetch(request, env, ctx);
    }

    if (url.pathname === "/mcp" || url.pathname === "/mcp/message") {
      return KuratchiMCP.serve("/mcp", { props: { apiKey } }).fetch(request, env, ctx);
    }

    if (url.pathname === "/") {
      return new Response(JSON.stringify({
        name: "Kuratchi MCP Server",
        version: "0.0.1",
        auth: "Pass your platform API token (kdbp_) via Authorization: Bearer header",
        endpoints: {
          sse: "/sse",
          streamable: "/mcp",
        },
      }, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
