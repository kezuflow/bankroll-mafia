export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor({
    details,
    message,
    status,
  }: {
    details: unknown;
    message: string;
    status: number;
  }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const details = await readErrorDetails(response);

    throw new ApiError({
      details,
      message: getErrorMessage(details, response.status),
      status: response.status,
    });
  }

  return response.json() as Promise<T>;
}

async function readErrorDetails(response: Response) {
  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    return response.json() as Promise<unknown>;
  }

  return response.text();
}

function getErrorMessage(details: unknown, status: number) {
  if (
    details &&
    typeof details === "object" &&
    "error" in details &&
    typeof details.error === "string"
  ) {
    return details.error;
  }

  return `API request failed: ${status}`;
}
