import { WorkerEntrypoint } from "cloudflare:workers";

type ServiceResult<T> = {
    success: boolean;
    data: T | null;
    error?: string;
};

interface Env {
    KURATCHI_DATABASE: DurableObjectNamespace;
}

type RunPayload = { query: string; params?: any[] };
type ExecPayload = { query: string };
type BatchPayload = { batch: Array<{ query: string; params?: any[] }> };
type RawPayload = { query: string; params?: any[] };
type FirstPayload = { query: string; params?: any[]; columnName?: string };

export class Database extends WorkerEntrypoint<Env> {
    protected db: DurableObjectNamespace;

    constructor(ctx: ExecutionContext, env: Env) {
        super(ctx, env);
        this.db = env.KURATCHI_DATABASE;
    }

    /**
     * Extract database name from request headers
     * The SDK passes x-db-name header to identify which DO instance to use
     */
    private getDbName(request: Request): string {
        const dbName = request.headers.get("x-db-name");
        if (!dbName) {
            throw new Error("x-db-name header is required");
        }
        return dbName;
    }

    private async resolveInput<TPayload extends object>(
        input: Request | (TPayload & { dbName: string })
    ): Promise<{ payload: TPayload; dbName: string }> {
        if (input instanceof Request) {
            const dbName = this.getDbName(input);
            const payload = await input.json() as TPayload;
            return { payload, dbName };
        }

        if (!input || typeof input !== 'object' || Array.isArray(input)) {
            throw new Error('Invalid RPC payload');
        }

        const { dbName, ...rest } = input as TPayload & { dbName?: string };
        if (!dbName) {
            throw new Error('RPC payload is missing dbName');
        }

        return { payload: rest as TPayload, dbName };
    }

    // database methods

    // run
    async run(input: Request | (RunPayload & { dbName: string })): Promise<any> {
        const { payload, dbName } = await this.resolveInput<RunPayload>(input);
        const stub = this.db.getByName(dbName);
        return await stub.run(payload);
    }

    // exec
    async exec(input: Request | (ExecPayload & { dbName: string })): Promise<any> {
        const { payload, dbName } = await this.resolveInput<ExecPayload>(input);
        const stub = this.db.getByName(dbName);
        return await stub.exec(payload);
    }

    // batch
    async batch(input: Request | (BatchPayload & { dbName: string })): Promise<any> {
        const { payload, dbName } = await this.resolveInput<BatchPayload>(input);
        const stub = this.db.getByName(dbName);
        return await stub.batch(payload);
    }

    async first(input: Request | (FirstPayload & { dbName: string })): Promise<any> {
        const { payload, dbName } = await this.resolveInput<FirstPayload>(input);
        const stub = this.db.getByName(dbName);
        return await stub.first(payload);
    }

    async raw(input: Request | (RawPayload & { dbName: string })): Promise<any> {
        const { payload, dbName } = await this.resolveInput<RawPayload>(input);
        const stub = this.db.getByName(dbName);
        return await stub.raw(payload);
    }
}