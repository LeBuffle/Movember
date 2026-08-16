import packageJson from "../../package.json";

/**
 * Application version, exposed by the health endpoint and used to identify
 * which build is currently running on a given environment.
 *
 * `APP_VERSION` is injected at build time by the deployment pipeline
 * (story 1.3) with the commit sha. It falls back to the package.json version
 * for local development, where no pipeline runs.
 *
 * `||` rather than `??`, and that is the whole point: an empty value is not
 * a value. A stray `APP_VERSION=` line in an environment file overrode the
 * one baked into the image, and `??` passed the empty string straight
 * through — so the health endpoint answered `"version": ""` while running
 * perfectly good code. An unanswerable "which build is live?" during an
 * incident is worse than a slightly wrong answer.
 */
export const APP_VERSION = process.env.APP_VERSION || packageJson.version;

/**
 * Deployment environment, used to make it obvious which instance is being
 * looked at — production and staging run the same code on the same host.
 */
export const APP_ENVIRONMENT = process.env.APP_ENVIRONMENT || "development";
