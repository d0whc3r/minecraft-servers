// Runtime selection: the panel drives either the local Docker/compose setup
// (repo bash scripts + docker CLI) or a Kubernetes cluster (one Helm release
// per server). Kubernetes mode is explicit: MCPANEL_RUNTIME=kubernetes — the
// web-panel chart sets it; native and containerized Docker runs keep the
// default. Dependency-free on purpose: both backends import from here.
export type RuntimeKind = "docker" | "kubernetes";

export const RUNTIME: RuntimeKind =
  process.env.MCPANEL_RUNTIME === "kubernetes" ? "kubernetes" : "docker";

export function isKubernetes(): boolean {
  return RUNTIME === "kubernetes";
}

/**
 * Namespace where the mc-<server> releases live. The web-panel chart exports
 * MCPANEL_K8S_NAMESPACE; the downward-API NAMESPACE is the fallback.
 */
export function k8sNamespace(): string {
  return (
    process.env.MCPANEL_K8S_NAMESPACE || process.env.NAMESPACE || "default"
  );
}

/** Helm release / deployment / service name for a server (mc-<server>). */
export function releaseName(server: string): string {
  return `mc-${server}`;
}

/** DNS of a server's in-cluster Service (RCON target for the panel). */
export function rconServiceDns(server: string): string {
  return `${releaseName(server)}.${k8sNamespace()}.svc.cluster.local`;
}

/** Internal RCON port the minecraft-server chart always configures. */
export const K8S_RCON_PORT = 25575;
