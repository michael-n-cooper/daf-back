import * as dbquery from '../../script/dbquery.js';

const sparql = "select distinct ?id ?label ?stmt where { ?id a a11y:AccessibilityStatement . ?id rdfs:label ?label ; a11y:stmtGuidance ?stmt } order by ?label";
var result;

export async function GET ({params, request}) => {
    
    result = "hi"//await dbquery.selectQuery(sparql);

  return new Response(
    JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  )
}