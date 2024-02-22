export function onRequest(
  context: ExecutionContext & { params: { name?: string } },
): Response {
  if (!context.params?.name) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(`Hello, ${context.params.name}!`);
}
