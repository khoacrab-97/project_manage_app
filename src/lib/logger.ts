import "server-only";
import { Axiom } from "@axiomhq/js";
import { AxiomJSTransport, ConsoleTransport, EVENT, Logger, type Transport } from "@axiomhq/logging";
import {
  levelForStatus,
  sanitizeLogFields,
  serializeError,
  type LogFields,
  type LogLevelName,
} from "./logger-core";
import { captureRawBodyFields } from "./raw-body-log";

type ApiRouteHandler<TArgs extends [Request, ...unknown[]]> = (...args: TArgs) => Response | Promise<Response>;

const axiomToken = process.env.AXIOM_TOKEN;
const axiomDataset = process.env.AXIOM_DATASET;

const transports: [Transport, ...Transport[]] =
  axiomToken && axiomDataset
    ? [
        new AxiomJSTransport({
          axiom: new Axiom({
            token: axiomToken,
            edge: process.env.AXIOM_EDGE,
            edgeUrl: process.env.AXIOM_EDGE_URL,
            onError: (error) => {
              console.error("axiom_ingest_failed", sanitizeLogFields(serializeError(error)));
            },
          }),
          dataset: axiomDataset,
        }),
        new ConsoleTransport({ prettyPrint: false }),
      ]
    : [new ConsoleTransport({ prettyPrint: false })];

const logger = new Logger({ transports });

const baseFields: LogFields = {
  service: process.env.AXIOM_SERVICE_NAME ?? "prmana-app",
  environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NODE_ENV,
  deploymentId: process.env.RAILWAY_DEPLOYMENT_ID,
  railwayServiceId: process.env.RAILWAY_SERVICE_ID,
};

export const serverLogger: Record<
  LogLevelName,
  (event: string, fields?: LogFields, error?: unknown) => void
> = {
  info: (event, fields) => writeLog("info", event, fields),
  warn: (event, fields) => writeLog("warn", event, fields),
  error: (event, fields, error) => writeLog("error", event, fields, error),
};

export async function flushLogs(): Promise<void> {
  try {
    await logger.flush();
  } catch (error) {
    console.error("logger_flush_failed", sanitizeLogFields(serializeError(error)));
  }
}

export function withApiLogging<TArgs extends [Request, ...unknown[]]>(
  route: string,
  handler: ApiRouteHandler<TArgs>
): ApiRouteHandler<TArgs> {
  return async (...args: TArgs) => {
    const [request] = args;
    const startedAt = Date.now();
    const requestBodyFields = await captureApiBodyFields(request, "request");

    try {
      const response = await handler(...args);
      const status = response.status;
      const level = levelForStatus(status);
      const responseBodyFields = await captureApiBodyFields(response, "response");

      serverLogger[level]("api_request_completed", {
        route,
        method: request.method,
        status,
        durationMs: Date.now() - startedAt,
        ...requestBodyFields,
        ...responseBodyFields,
      });
      scheduleFlush();

      return response;
    } catch (error) {
      serverLogger.error(
        "api_request_failed",
        {
          route,
          method: request.method,
          status: 500,
          durationMs: Date.now() - startedAt,
          ...requestBodyFields,
        },
        error
      );
      await flushLogs();
      throw error;
    }
  };
}

function writeLog(level: LogLevelName, event: string, fields: LogFields = {}, error?: unknown): void {
  const payload = sanitizeLogFields({
    ...baseFields,
    event,
    ...fields,
    ...(error === undefined ? {} : serializeError(error)),
  });

  try {
    logger[level](event, { ...payload, [EVENT]: rootLogFields(payload) });
  } catch (logError) {
    console.error("logger_write_failed", {
      attemptedLevel: level,
      attemptedEvent: event,
      ...sanitizeLogFields(serializeError(logError)),
    });
  }
}

function scheduleFlush(): void {
  void flushLogs();
}

async function captureApiBodyFields(source: Request | Response, side: "request" | "response"): Promise<LogFields> {
  if (process.env.AXIOM_LOG_FULL_API_BODIES !== "true") return {};
  return {
    apiBodyLogging: "raw_full",
    ...(await captureRawBodyFields(source, side)),
  };
}

function rootLogFields(payload: LogFields): LogFields {
  return sanitizeLogFields({
    event: payload.event,
    service: payload.service,
    environment: payload.environment,
    deploymentId: payload.deploymentId,
    railwayServiceId: payload.railwayServiceId,
  });
}
