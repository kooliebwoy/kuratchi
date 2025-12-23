import { WorkerEntrypoint } from "cloudflare:workers";
import { KuratchiDatabase } from "./durable-objects/kuratchi-database";
import { Database } from "./entrypoints/database";

export default class extends WorkerEntrypoint {}

// entry point
export {
    // entrypoints
    Database,

    // durable objects
    KuratchiDatabase,
};