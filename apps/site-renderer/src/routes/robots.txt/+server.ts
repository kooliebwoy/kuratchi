import { env } from "$env/dynamic/private";

const site = env.ORIGIN;

export async function GET() {
	return new Response(
		`User-agent: * \nSitemap: ${site}/sitemap.xml`.trim(),
		{
			headers: {
				'Content-Type': 'text/plain',
			},
		},
	);
}