// In-process exclusion shared by lifecycle actions and registry removal.
const busyServers = new Set<string>();

export class ServerOperationConflict extends Error {
  constructor() {
    super("Another action is already running for this server");
  }
}

export function isServerOperationRunning(server: string): boolean {
  return busyServers.has(server);
}

export async function withServerOperation<T>(
  server: string,
  operation: () => Promise<T>,
): Promise<T> {
  if (busyServers.has(server)) throw new ServerOperationConflict();
  busyServers.add(server);
  try {
    return await operation();
  } finally {
    busyServers.delete(server);
  }
}
