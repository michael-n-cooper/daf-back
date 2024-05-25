import * as dbquery from '../../script/dbquery.js';
import {baseUri, idFrag} from '../../script/util.js';

const sparql = "select distinct ?id ?label ?stmt where { ?id a a11y:AccessibilityStatement . ?id rdfs:label ?label ; a11y:stmtGuidance ?stmt } order by ?label";
const result = await dbquery.selectQuery(sparql);

export async function GET({params, request}) {
  return new Response(
    result, {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  )
}