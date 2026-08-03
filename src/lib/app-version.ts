import packageJson from "../../package.json";

/**
 * Application version, exposed by the health endpoint and used to identify
 * which build is currently running on a given environment.
 *
 * `APP_VERSION` is injected at build time by the deployment pipeline
 * (story 1.3) with the commit sha. It falls back to the package.json version
 * for local development, where no pipeline runs.
 */
export const APP_VERSION = process.env.APP_VERSION ?? packageJson.version;

/**
 * Deployment environment, used to make it obvious which instance is being
 * looked at — production and staging run the same code on the same host.
 */
export const APP_ENVIRONMENT = process.env.APP_ENVIRONMENT ?? "development";
