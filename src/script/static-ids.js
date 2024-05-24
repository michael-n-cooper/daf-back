import { writeFile } from 'node:fs/promises';
import * as dbquery from './dbquery.js';

async function lookupIds(type) {
	var params = new Array();
	const sparql = 'select ?id where { ?id a a11y:' + type + ' }';
	const result = await dbquery.selectQuery(sparql);
	result.results.bindings.forEach(function(item) {
		params.push({"params": {"id": dbquery.idFrag(item.id.value)}});
	});
	return params;
}

async function process(section) {
	const ids = await lookupIds(section.type);
	writeFile("../pages/" + section.path + "/ids.js", "export const ids = JSON.parse('" + JSON.stringify(ids) + "');");
	console.log(section.path);
}

let paths = new Array();
paths.push({"path": "functional-need-categories", "type": "FunctionalNeedCategory"});
paths.push({"path": "functional-needs", "type": "FunctionalNeed"});
paths.push({"path": "intersection-needs", "type": "IntersectionNeed"});
paths.push({"path": "guidance-statements", "type": "AccessibilityStatement"});
paths.push({"path": "references", "type": "Reference"});
paths.push({"path": "tags", "type": "Tag"});
paths.push({"path": "user-need-contexts", "type": "UserNeedRelevance"});
paths.push({"path": "user-needs", "type": "UserNeed"});

let promises = new Array();
paths.forEach(function(section) {
	promises.push(process(section));
});

Promise.all(promises);