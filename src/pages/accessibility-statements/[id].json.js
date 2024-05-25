import type { APIRoute } from 'astro';

const usernames = ["Sarah", "Chris", "Yan", "Elian"]

export const GET: APIRoute = ({ params, request }) => {
  const id = params.id;
  return new Response(
    JSON.stringify({
      name: usernames[id]
    })
  )
}
/*
export async function getStaticPaths() { 
	const module = await import('./ids.js');
	const {ids} = module;
	return (ids);
}
*/