import { AxiomWithoutBatching } from "@axiomhq/js";
import { sanitizeLogFields, serializeError, type LogFields } from "./logger-core";

let axiom: AxiomWithoutBatching | null | undefined;

export function logProxyRequest(fields: LogFields): Promise<void> {
  const event = String(fields.event ?? "web_request_seen");
  const payload = sanitizeLogFields({
    service: process.env.AXIOM_SERVICE_NAME ?? "prmana-app",
    environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NODE_ENV,
    deploymentId: process.env.RAILWAY_DEPLOYMENT_ID,
    railwayServiceId: process.env.RAILWAY_SERVICE_ID,
    ...fields,
    event,
  });

  const client = axiomClient();
  if (!client || !process.env.AXIOM_DATASET) {
    console.log(`info - ${event} ${JSON.stringify(payload)}`);
    return Promise.resolve();
  }

  return client.ingest(process.env.AXIOM_DATASET, payload).then((status) => {
    if (status.failed > 0 || status.ingested === 0) {
      console.error(
        "axiom_proxy_ingest_failed",
        sanitizeLogFields({ event: "axiom_proxy_ingest_failed", status })
      );
    }
  });
}

function axiomClient(): AxiomWithoutBatching | null {
  if (axiom !== undefined) return axiom;

  const token = process.env.AXIOM_TOKEN;
  if (!token) {
    axiom = null;
    return axiom;
  }

  axiom = new AxiomWithoutBatching({
    token,
    edge: process.env.AXIOM_EDGE,
    edgeUrl: process.env.AXIOM_EDGE_URL,
    onError: (error) => {
      console.error("axiom_proxy_error", sanitizeLogFields(serializeError(error)));
    },
  });
  return axiom;
}
