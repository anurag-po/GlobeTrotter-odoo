export interface EmailOptions {
  to: string;
  template: string;
  data: Record<string, string>;
}

export interface EmailService {
  send(options: EmailOptions): Promise<void>;
}

export interface PresignedUrlOptions {
  key: string;
  contentType: string;
  maxSizeBytes: number;
}

export interface StorageService {
  generatePresignedUploadUrl(options: PresignedUrlOptions): Promise<{ uploadUrl: string; objectUrl: string; expiresAt: string }>;
  deleteObject(key: string): Promise<void>;
}

export interface JobService {
  enqueue(jobName: string, payload: Record<string, unknown>): Promise<void>;
}
