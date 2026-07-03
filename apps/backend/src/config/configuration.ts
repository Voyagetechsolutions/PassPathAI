/**
 * Centralised, typed application configuration.
 * Loaded once via @nestjs/config and injected as `AppConfig`.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  database: { url: string };
  redis: { host: string; port: number; password?: string };
  firebase: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
    serviceAccountPath?: string;
  };
  openai: {
    apiKey: string;
    chatModel: string;
    embeddingModel: string;
    embeddingDim: number;
  };
  storage: {
    driver: 's3' | 'local';
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
    localDir: string;
  };
  rateLimit: { ttl: number; limit: number };
  // Dev-only password login for demo accounts. NEVER honoured in production.
  devAuth: { enabled: boolean; demoPassword: string };
  paystack: {
    secretKey: string;
    publicKey: string;
    planCode: string;
    // Amount in cents (ZAR "kobo" equivalent) — used only if planCode is unset
    // and PaystackService auto-creates the plan on first use.
    monthlyAmountCents: number;
  };
}

const splitCsv = (value?: string): string[] =>
  (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  corsOrigins: splitCsv(process.env.CORS_ORIGINS),
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? '',
    // Allow literal "\n" in env to represent newlines.
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || undefined,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    chatModel: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
    embeddingDim: parseInt(process.env.OPENAI_EMBEDDING_DIM ?? '1536', 10),
  },
  storage: {
    driver: (process.env.STORAGE_DRIVER as 's3' | 'local') ?? 's3',
    region: process.env.AWS_REGION ?? 'af-south-1',
    bucket: process.env.AWS_S3_BUCKET ?? '',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    endpoint: process.env.AWS_S3_ENDPOINT || undefined,
    localDir: process.env.STORAGE_LOCAL_DIR ?? './storage',
  },
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL ?? '60', 10),
    limit: parseInt(process.env.RATE_LIMIT_LIMIT ?? '120', 10),
  },
  devAuth: {
    // Hard gate: only ever enabled outside production, and only when opted in.
    enabled:
      (process.env.NODE_ENV ?? 'development') !== 'production' &&
      process.env.ENABLE_DEV_AUTH === 'true',
    demoPassword: process.env.DEMO_PASSWORD ?? 'passpath-demo',
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY ?? '',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY ?? '',
    planCode: process.env.PAYSTACK_PLAN_CODE ?? '',
    monthlyAmountCents: parseInt(process.env.PAYSTACK_MONTHLY_AMOUNT_CENTS ?? '20000', 10),
  },
});
