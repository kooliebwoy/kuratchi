// import { env } from "$env/dynamic/private";

// const site = env.ORIGIN;

// export async function GET() {
//     // get menu from the CMS endpoint, as this is the pages paths
//     const endpoint = `${env.KAYDE_CMS_ENDPOINT}/menus`;
    
//     const getMenu = await fetch(endpoint, {
//         headers: {
//             'Authorization': `Bearer ${env.KAYDE_CMS_TOKEN}`,
//             'Content-Type': 'application/json',
//             'Origin': env.ORIGIN
//         }
//     });
    
//     const pages = await getMenu.json();

// 	return new Response(
// 		`
// 		<?xml version="1.0" encoding="UTF-8" ?>
// 		<urlset
// 			xmlns="https://www.sitemaps.org/schemas/sitemap/0.9"
// 			xmlns:xhtml="https://www.w3.org/1999/xhtml"
// 			xmlns:mobile="https://www.google.com/schemas/sitemap-mobile/1.0"
// 			xmlns:news="https://www.google.com/schemas/sitemap-news/0.9"
// 			xmlns:image="https://www.google.com/schemas/sitemap-image/1.1"
// 			xmlns:video="https://www.google.com/schemas/sitemap-video/1.1"
// 		>
//             <url>
//                 <loc>${site}</loc>
//                 <changefreq>daily</changefreq>
//                 <priority>0.7</priority>
//             </url>
//             ${pages.map(({ link }: string) => `
//                 <url>
//                     <loc>${site}/${link}</loc>
//                     <changefreq>daily</changefreq>
//                     <priority>0.7</priority>
//                 </url>
//             `).join('')}
// 		</urlset>`.trim(),
// 		{
// 			headers: {
// 				'Content-Type': 'application/xml',
// 			},
// 		},
// 	);
// }