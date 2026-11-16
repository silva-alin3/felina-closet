export default {
 async fetch(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/product") return env.ASSETS.fetch(request);
  if (request.method !== "GET") return Response.json({error:"Método não permitido."},{status:405});
  const target = url.searchParams.get("url");
  if (!target) return Response.json({error:"Informe o link do produto."},{status:400});
  let productUrl;
  try { productUrl = new URL(target); } catch { return Response.json({error:"Link inválido."},{status:400}); }
  if (productUrl.protocol !== "https:" || !/(^|\.)shein\.com$/i.test(productUrl.hostname))
   return Response.json({error:"Use um endereço oficial da SHEIN."},{status:400});
  try {
   const upstream = await fetch(productUrl.toString(), {
    headers: {
     "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
     "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
     "Accept-Language":"pt-BR,pt;q=0.9,en;q=0.8"
    },
    redirect:"follow"
   });
   if (!upstream.ok) return Response.json({error:"A SHEIN bloqueou ou não liberou a leitura dessa página (HTTP "+upstream.status+"). Tente outro link ou preencha os dados manualmente."},{status:502});
   const html = await upstream.text();
   const decode = s => s.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&#x27;/gi,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
   const metas = {};
   for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = {};
    for (const m of tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)) attrs[m[1].toLowerCase()] = decode(m[2]);
    const key = (attrs.property || attrs.name || "").toLowerCase();
    if (key && attrs.content) metas[key] = attrs.content;
   }
   let title=metas["og:title"]||metas["twitter:title"]||"";
   let image=metas["og:image"]||metas["twitter:image"]||"";
   let description=metas["og:description"]||metas["description"]||"";
   let price=metas["product:price:amount"]||metas["og:price:amount"]||"";
   if (!price) {
    const m=html.match(/"(?:salePrice|retailPrice|specialPrice|price)"\s*:\s*"?([0-9]+(?:\.[0-9]{1,2})?)"?/i);
    if(m) price=m[1];
   }
   if (!title) {
    const m=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if(m) title=decode(m[1].replace(/<[^>]+>/g,"").trim());
   }
   title=title.replace(/\s*[|｜-]\s*SHEIN.*$/i,"").trim();
   if (description.length>300) description=description.slice(0,297)+"...";
   return Response.json({title,image,description,price},{headers:{"Cache-Control":"no-store"}});
  } catch (e) {
   return Response.json({error:"Não consegui acessar a página da SHEIN agora. Tente novamente ou preencha os campos manualmente."},{status:502});
  }
 }
};
