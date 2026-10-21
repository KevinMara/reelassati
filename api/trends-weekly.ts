/** Permanently retired: old scheduler requests must never reach a provider. */
export async function handleWeeklyTrendCron(
  request: Request
): Promise<Response> {
  void request;
  return Response.json(
    {
      error: "Automatic research is disabled.",
      code: "automatic-research-disabled",
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}

export default { fetch: handleWeeklyTrendCron };
