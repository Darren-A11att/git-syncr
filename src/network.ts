export async function checkNetwork(): Promise<boolean> {
  try {
    const response = await fetch('https://github.com', {
      method: 'HEAD',
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok || response.status === 301;
  } catch {
    return false;
  }
}
