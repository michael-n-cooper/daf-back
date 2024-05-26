import type { APIRoute } from "astro";
import * as dbquery from '../../script/dbquery.js';

export const GET: APIRoute = async({params, request}) => {
    return new Response(JSON.stringify({
      message: "This was a GET!"
    })
  )
  /*
    const sparql = "select distinct ?id ?label ?stmt where { ?id a a11y:AccessibilityStatement . ?id rdfs:label ?label ; a11y:stmtGuidance ?stmt } order by ?label";
    const result = await dbquery.selectQuery(sparql);
    console.log(result);

  return new Response(
    JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  )*/
}