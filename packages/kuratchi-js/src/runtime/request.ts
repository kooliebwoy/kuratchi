export let url: URL = new URL('http://localhost/');
export let pathname = '/';
export let searchParams: URLSearchParams = url.searchParams;
export let headers = new Headers();
export let method = 'GET';
export let params: Record<string, string> = {};
export let slug: string | undefined = undefined;

function __syncDerivedState(): void {
  pathname = url.pathname;
  searchParams = url.searchParams;
  slug = params.slug;
}

export function __setRequestState(request: Request): void {
  url = new URL(request.url);
  headers = request.headers;
  method = request.method;
  params = {};
  __syncDerivedState();
}

export function __setRequestParams(nextParams: Record<string, string> | null | undefined): void {
  params = nextParams ?? {};
  __syncDerivedState();
}
