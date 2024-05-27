const prefixes = `prefix :		<https://github.com/michael-n-cooper/a11y-data/daf/#>
prefix a11y:	<https://aihal.net/accessibility/daf/#>
prefix owl:		<http://www.w3.org/2002/07/owl#>
prefix rdf:		<http://www.w3.org/1999/02/22-rdf-syntax-ns#>
prefix rdfs:	<http://www.w3.org/2000/01/rdf-schema#>
`;
const selectEndpoint = "http://localhost:7200/repositories/a11y-data";
const updateEndpoint = "http://localhost:7200/repositories/a11y-data/statements";

export async function selectQuery(sparql) {
	const post_response = await fetch(selectEndpoint,
	  {
	    method: 'POST',
	    headers: {'Content-Type':'application/sparql-query', 'Accept':'application/json'},
	    body: prefixes + sparql
	  });
	const json = await post_response.json();
	return (json);
}

export async function updateQuery(sparql) {
	const post_response = await fetch(updateEndpoint,
	  {
	    method: 'POST',
	    headers: {'Content-Type':'application/sparql-update', 'Accept':'application/json'},
	    body: prefixes + sparql
	  });
	//const json = await post_response.json();
	//return (json);
	return true;
}
