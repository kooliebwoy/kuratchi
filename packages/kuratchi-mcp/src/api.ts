const API_BASE = "https://kuratchi.cloud/api/v1";

export class KuratchiAPI {
  constructor(private apiKey: string) {}

  private async request(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
    } = {}
  ) {
    const { method = "GET", body, headers = {} } = options;

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  async health() {
    return this.request("/health");
  }

  async listDatabases() {
    return this.request("/platform/databases");
  }

  async createDatabase(name: string, locationHint?: string) {
    return this.request("/platform/databases", {
      method: "POST",
      body: { name, ...(locationHint && { locationHint }) },
    });
  }

  async getDatabase(id: string) {
    return this.request(`/platform/databases/${id}`);
  }

  async deleteDatabase(id: string) {
    return this.request(`/platform/databases/${id}`, { method: "DELETE" });
  }

  async redeployDatabase(id: string) {
    return this.request(`/platform/databases/${id}`, {
      method: "PATCH",
      body: { action: "redeploy" },
    });
  }

  async listKVNamespaces() {
    return this.request("/platform/kv");
  }

  async createKVNamespace(name: string) {
    return this.request("/platform/kv", {
      method: "POST",
      body: { name },
    });
  }

  async getKVNamespace(id: string) {
    return this.request(`/platform/kv/${id}`);
  }

  async deleteKVNamespace(id: string) {
    return this.request(`/platform/kv/${id}`, { method: "DELETE" });
  }

  async listR2Buckets() {
    return this.request("/platform/r2");
  }

  async createR2Bucket(name: string, locationHint?: string) {
    return this.request("/platform/r2", {
      method: "POST",
      body: { name, ...(locationHint && { locationHint }) },
    });
  }

  async getR2Bucket(id: string) {
    return this.request(`/platform/r2/${id}`);
  }

  async deleteR2Bucket(id: string) {
    return this.request(`/platform/r2/${id}`, { method: "DELETE" });
  }

  async createToken(params: {
    type: "database" | "kv" | "r2";
    name: string;
    databaseId?: string;
    kvNamespaceId?: string;
    r2BucketId?: string;
  }) {
    if (params.type === "database") {
      return this.request("/platform/tokens/database", {
        method: "POST",
        body: {
          name: params.name,
          databaseId: params.databaseId,
        },
      });
    }

    if (params.type === "kv") {
      return this.request("/platform/tokens/kv", {
        method: "POST",
        body: {
          name: params.name,
          kvNamespaceId: params.kvNamespaceId,
        },
      });
    }

    return this.request("/platform/tokens/r2", {
      method: "POST",
      body: {
        name: params.name,
        r2BucketId: params.r2BucketId,
      },
    });
  }

  async revokeToken(tokenId: string) {
    return this.request(`/platform/tokens/${tokenId}`, { method: "DELETE" });
  }

  async queryDatabase(dbName: string, sql: string, scopedToken: string) {
    const res = await fetch(`${API_BASE}/${dbName}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${scopedToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Query error ${res.status}: ${text}`);
    }

    return res.json();
  }
}
