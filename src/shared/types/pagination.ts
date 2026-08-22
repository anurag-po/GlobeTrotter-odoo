export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface CursorPaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface CursorPaginationParams {
  cursor?: string;
  pageSize?: number;
}
