export function loader() {
  // Return 404 for any unmatched routes without logging
  throw new Response(null, { status: 404 });
}