declare namespace Cloudflare {
  interface Env {
    SAV3_JOB_SECRET?: string;
    RESEND_API_KEY?: string;
    MAIL_FROM?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_WORKSPACE_DOMAIN?: string;
    ASSETS?: Fetcher;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
