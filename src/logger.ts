// Structured JSON logging only. No bare console elsewhere in the app.
function log(event: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n");
}

export default log;
