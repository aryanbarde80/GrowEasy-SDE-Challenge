export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const targetBaseUrl = getBackendBaseUrl();

  const response = await fetch(`${targetBaseUrl}/api/import`, {
    method: "POST",
    body: formData,
    cache: "no-store",
  });

  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}

function getBackendBaseUrl() {
  if (process.env.BACKEND_HOST) {
    const backendPort = process.env.BACKEND_PORT ?? "10000";
    return `http://${process.env.BACKEND_HOST}:${backendPort}`;
  }

  return process.env.BACKEND_PUBLIC_URL ?? "http://localhost:4000";
}
