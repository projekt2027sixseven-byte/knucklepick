/**
 * Load env before Prisma / createApp (DATABASE_URL, JWT_SECRET, …).
 * Point DATABASE_URL at a dev database; tests are integration-style and mutate data with unique emails.
 */
import "../bootstrap-env";
