export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | ReadableStream | ArrayBuffer | Blob | null;
}
