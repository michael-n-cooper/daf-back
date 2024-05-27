import { readFile, writeFile, open } from 'node:fs/promises';
import parseMD from 'parse-md';
import * as dbquery from './dbquery.js';
import {findObjectByProperties, filterObjectByProperties, idFrag, compareStr, normalizeStr, isValidUrl, getOneProp, getFileData, escSparql} from './util-base.js';
import inquirer from 'inquirer';
import * as commonmark from 'commonmark';

const importDir = '../../../../accessiblecommunity/Digital-Accessibility-Framework/';
const importFileName = await inquirer.prompt([{"name": "fileName", "message": "File to import:", }]).then((answer) => answer.fileName); 
const typosPath = './typos.json';
const contentIriBase = 'https://github.com/accessiblecommunity/Digital-Accessibility-Framework/';

const data = await getFileData(importDir + importFileName);
// need to catch bad file name
if (data == null) {
	// check if file previously imported but deleted
	let sparql = 'select ?id where { ?id a11y:contentIRI <' + contentIriBase + importFileName + '> }';
	let result = await dbquery.selectQuery(sparql);
	// previously imported
	if (result.results.bindings.length > 0) {
		const message = "The file \"" + importFileName + "\" was previously imported but cannot be found. Do you want to delete data from this file?";
		const todel = await inquirer.prompt([{ "name": "todel", "type": "confirm", "message": message, }]).then((answer) => answer.todel);
		if (todel) {
			deleteStatement(idFrag(result.results.bindings[0].id.value));
			console.log("Deleted " + importFileName);
		} else console.log("Aborting");
		process.exit(0);
	}
	// bad file name
	else {
		console.log("Unable to find file \"" + importFileName + "\"");
		process.exit(1);
	}
}

const { metadata, content } = parseMD(data);

const knownMatrix = await getKnownMatrix();

const typos = await getTypos();
const functionalNeedList = await lookupIdLabels("FunctionalNeed");
const intersectionNeedList = await lookupIntersectionNeeds();
const userNeedList = await lookupIdLabels("UserNeed");
const userNeedRelevanceList = await lookupIdLabels("UserNeedRelevance");
await findMatrixTypos();

const mappings = expandMappings(metadata);
const mappingIds = await getMappingIds(mappings); // ids of the mapping objects corresponding to the above
const referenceTypes = await lookupIdLabels("ReferenceType");
const tags = await lookupIdLabels("Tag");
const tagsArr = metadata.tags ? metadata.tags : new Array(); // retrieve tags
const { research, guidelines } = retrieveReferences(metadata); // retrieve references, divide into research and guidelines
const { title, statement, notes } = retrieveContent(content); // retrieve title and statement

// check for previous
let stmtId = await checkReimport(contentIriBase + importFileName);
if (stmtId != false) {
	
	// construct the sparql statement
	if (stmtId == null) stmtId = dbquery.uuid();
	let sparql = 'insert data { :' + stmtId + ' a a11y:AccessibilityStatement ; a owl:NamedIndividual ';
	sparql += ' ; a11y:stmtGuidance "' + escSparql(statement) + '"@en';
	sparql += ' ; rdfs:label "' + escSparql(title) + '"@en';
	if (notes.length > 0) sparql += ' ; a11y:note "' + escSparql(notes) + '"@en';
	sparql += ' ; a11y:contentIRI <' + contentIriBase + importFileName + ">";
	mappingIds.forEach(function(mapping) {
		sparql += ' ; a11y:supports :' + mapping;
	});
	tagsArr.forEach(function(tag) {
		sparql += ' ; a11y:tags :' + getIdByLabel(tags, tag, 'Tag');
	});
	if (research.length > 0) {
		research.forEach(function(link) {
			const linkId = dbquery.uuid();
			sparql += ' . :' + linkId + ' a a11y:Reference ; a11y:refIRI <' + link.uri + '> ; a11y:refNote "' + escSparql(link.note) + '"@en ; a11y:refType :' + getIdByLabel(referenceTypes, 'research', 'ReferenceType');
			sparql += ' . :' + stmtId + ' a11y:references :' + linkId;
		});
	}
	if (guidelines.length > 0) {
		guidelines.forEach(function(link) {
			const linkId = dbquery.uuid();
			sparql += ' . :' + linkId + ' a a11y:Reference ; a11y:refIRI <' + link.uri + '> ; a11y:refNote "' + escSparql(link.note) + '"@en ; a11y:refType :' + getIdByLabel(referenceTypes, 'guidelines', 'ReferenceType');
			sparql += ' . :' + stmtId + ' a11y:references :' + linkId;
		});
	}
	sparql += ' }';
	//console.log(sparql);
	const importResult = await dbquery.updateQuery(sparql);
	console.log(JSON.stringify(importResult));
} else console.log("Aborting");


// get a {id, label} of matrix dimensions
async function getKnownMatrix() { // add intersections
	var matrix = new Array();	
	const fromDb = await dbquery.selectQuery('select ?id ?label where { ?id a a11y:MatrixDimension ; rdfs:label ?label } order by ?label'); // should split into one for each type to avoid same-label issues
	fromDb.results.bindings.forEach(function(item) {
		matrix.push({id: idFrag(item.id.value), label: item.label.value});
	});
	return matrix;
}

// matrix dimensions (functional needs, user needs, relevances)
function getMatrixDimId(label) {
	var returnval = null;
	
	// check against list of known typos, correct
	label = checkTypo(label);
	
	var matrixDimId = findObjectByProperties(knownMatrix, {"label": label});
	return matrixDimId.id;
}

// find an intersection need in the local array from 2 functional need ids
function getIntersectionNeedId(fn1, fn2) {
	var inId;
	const intersection = findObjectByProperties(intersectionNeedList, {"fn1": fn1, "fn2": fn2});
	
	if (typeof intersection === 'undefined') {
		inId = dbquery.uuid();
		const label1 = findObjectByProperties(functionalNeedList, {"id": fn1}).label;
		const label2 = findObjectByProperties(functionalNeedList, {"id": fn2}).label;
		const update = 'insert data { :' + inId + ' a a11y:IntersectionNeed ; a11y:supports :' + fn1 + ' ; a11y:supports :' + fn2 + ' ; rdfs:label "' + label1 + " and " + label2 + '"@en}';
		dbquery.updateQuery(update);
	} else {
		inId = intersection.id;
	}
	return inId;
}

// get intersection needs from the db
async function lookupIntersectionNeeds() {
	var arr = new Array();
	const sparql = 'select ?id ?fn1 ?fn2 where { ?id a a11y:IntersectionNeed ; a11y:supports ?fn1 ; a11y:supports ?fn2 . filter (!sameterm(?fn1, ?fn2)) }';
	const results = await dbquery.selectQuery(sparql);
	if (typeof results.results.bindings !== 'undefined') results.results.bindings.forEach(function(item) {
		arr.push({"id": idFrag(item.id.value), "fn1": idFrag(item.fn1.value), "fn2": idFrag(item.fn2.value)});
	});
	return arr;
}

// matrix mappings
function expandMappings(metadata) {
	var expandedMappings = new Array();
	const mappings = metadata.mappings;
	
	mappings.forEach(function(mapping) {
		// check for keyword "all"
		//if (typeof mapping['functional-need'] === 'string' && compareStr(mapping['functional-need'], "all")) mapping['functional-need'] = getOneProp(functionalNeedList, 'label');
		if (typeof mapping['user-need'] === 'string' && compareStr(mapping['user-need'], "all")) mapping['user-need'] = getOneProp(userNeedList, 'label');
		if (typeof mapping['user-need-relevance'] === 'string' && compareStr(mapping['user-need-relevance'], "all")) mapping['user-need-relevance'] = getOneProp(userNeedRelevanceList, 'label');
	
		// make sure the values are arrays
		const functionalNeeds = (typeof mapping['functional-need'] === 'string' || (typeof mapping['functional-need'] === 'object' && !Array.isArray(mapping['functional-need']))) ? [mapping['functional-need']] : mapping['functional-need'];
		const userNeeds = (typeof mapping['user-need'] === 'string') ? [mapping['user-need']] : mapping['user-need'];
		const userNeedRelevances = (typeof mapping['user-need-relevance'] === 'string') ? [mapping['user-need-relevance']] : mapping['user-need-relevance'];
		
		// expand out arrays of mapped items
		functionalNeeds.forEach(function(functionalNeed) {
			var functionalNeedId;
			var fnType = "FunctionalNeed";
			if (typeof functionalNeed === 'object') {
				const fn1 = getMatrixDimId(functionalNeed.intersection[0]);
				const fn2 = getMatrixDimId(functionalNeed.intersection[1]);
				functionalNeedId = getIntersectionNeedId(fn1, fn2);
				fnType = "IntersectionNeed"
			} else functionalNeedId = getMatrixDimId(functionalNeed);
			userNeeds.forEach(function(userNeed) {
				const userNeedId = getMatrixDimId(userNeed);
				userNeedRelevances.forEach(function(userNeedRelevance) {
					const userNeedRelevanceId = getMatrixDimId(userNeedRelevance);
					expandedMappings.push({[fnType]: functionalNeedId, "UserNeed": userNeedId, "UserNeedRelevance": userNeedRelevanceId});
				});
			});
		});
	});
	return (expandedMappings);
}

// populate array with ids of mapping objects corresponding to a set of [functional need, user need, relevance]
async function getMappingIds(mappings) {
	async function collect() {
		let promises = new Array();
		var result = new Array();
		mappings.forEach(function(mapping) {
			promises.push(getMappingId(mapping));
		});
		return Promise.all(promises);
	}
	var results = await collect();
	return results;
}

// get a single mapping object from the stored array, or add one if not exists
async function getMappingId(mapping) {
	var functionalNeedId = (mapping.FunctionalNeed || mapping.IntersectionNeed);
	const sparql = 'select ?id where { ?id a a11y:Mapping ; a11y:supports :' + functionalNeedId + ' ; a11y:supports :' + mapping.UserNeed + ' ; a11y:supports :' + mapping.UserNeedRelevance + ' }';
	var results = await dbquery.selectQuery(sparql);
	if (results.results.bindings.length == 0) {
		var mapType = "MatrixMapping";
		if (typeof mapping.FunctionalNeed === 'undefined') mapType = "IntersectionMapping";
		const uuid = dbquery.uuid();
		const update = 'insert data { :' + uuid + ' a a11y:' + mapType + ' ; a owl:NamedIndividual ; a11y:supports :' + functionalNeedId + ' ; a11y:supports :' + mapping.UserNeed + ' ; a11y:supports :' + mapping.UserNeedRelevance + ' }';
		await dbquery.updateQuery(update);
		return (uuid);
	} else {
		return idFrag(results.results.bindings[0].id.value);
	}
}

// general

// get the id for a label on a class, add it to the database if not found
function getIdByLabel(arr, label, addClass) {
	var id = null;
	
	const idObj = findObjectByProperties(arr, {"label": label});
	if (typeof idObj !== 'undefined') id = idObj.id;
	
	if (id == null && addClass !== undefined) {
		id = dbquery.uuid();
		const updateSparql = 'insert data { :' + id + ' a a11y:' + addClass + ' ; rdfs:label "' + label + '"@en }';
		dbquery.updateQuery(updateSparql);
	}
	
	return id;
}

// get an array of {id, label} for a class
async function lookupIdLabels(type) {
	var returnval = new Array();
	const sparql = 'select ?id ?label where { ?id a a11y:' + type + ' ; rdfs:label ?label } order by ?label';
	const results = await dbquery.selectQuery(sparql);
	if (results.results.bindings.length > 0) {
		results.results.bindings.forEach(function(result) {
			returnval.push({id: idFrag(result.id.value), label: result.label.value});
		});
	}
	return returnval;
}

// references
function retrieveReferences(metadata) {
	var research = new Array();
	var guidelines = new Array();
	if (metadata.references) {
		const references = metadata.references;
		
		references.forEach(function(referenceType) {
			if (referenceType.research !== undefined && Array.isArray(referenceType.research)) {
				referenceType.research.forEach(function(ref) {
					if (Array.isArray(ref) && isValidUrl(ref[0])) research.push({"uri": ref[0], "note": ref.slice(1).join(", ")});
				});
			}
			if (referenceType.guidelines !== undefined && Array.isArray(referenceType.guidelines)) {
				referenceType.guidelines.forEach(function(ref) {
					if (Array.isArray(ref) && isValidUrl(ref[0])) guidelines.push({"uri": ref[0], "note": ref.slice(1).join(", ")});
				});
			}
		});
		
	}
	
	return {"research": research, "guidelines": guidelines};
}

// content
function retrieveContent(content) {
	let reader = new commonmark.Parser();
	let parsed = reader.parse(content);
	//console.log(parsed);
	let walker = parsed.walker();

	let event, node, entering;
	let title = "";
	let statement = "";
	let notes = ""; 
	let lookingFor = "heading"
	let inside = "";
	let pbreak = false;
	while ((event = walker.next())) {
		node = event.node;
		entering = event.entering;

		if (node.type == 'heading') {
			if (entering) {
				inside = "heading";
			}
			else {
				inside = "";
				lookingFor = "statement";
			}
		}
		if (node.type == 'paragraph') {
			if (entering) {
				if (inside != "item") {
					inside = "paragraph";
					pbreak = true;
				}
			}
			else {
				if (inside != "item") inside = "";
				if (lookingFor == "statement") lookingFor = "thematic_break";
				pbreak = false;
			}
		}
		if (node.type == 'thematic_break') {
			lookingFor = "notes";
		}
		if (node.type == 'item') {
			if (entering) {
				inside = "item";
			}
			else {
				inside = "";
			}
		}
		if (node.type == "text") {
			if (lookingFor == "heading" && inside == "heading") title += node.literal + " ";
			if (lookingFor == "statement" && inside == "paragraph") statement += node.literal + " ";
			if (lookingFor == "notes" && (inside == "paragraph" || inside == "item")) {
				if (notes.length > 0) {
					notes += "\\n";
					if (pbreak) notes += "\\n";
					pbreak = false;
				}
				if (inside == "item") notes += "* ";
				notes += node.literal;
			}
		}
	}

	return { "title": normalizeStr(title), "statement": normalizeStr(statement), "notes": notes.trim() };
}

// typo handling

// load list of typs
async function getTypos() {
	try {
	  const contents = await readFile(typosPath, { encoding: 'utf8' });
	  const json = JSON.parse(contents);
	  return (json);
	} catch (err) {
	  console.error(err.message);
	}
}

// add a typo to the list
function storeTypo(inc, cor) {
	typos.push({incorrect: inc, correct: cor});
}

// save the list of typos
async function saveTypos() {
	try {
		await writeFile(typosPath, JSON.stringify(typos), { encoding: 'utf8' });
	} catch (err) {
	  console.error(err);
	} 
}

// check if a value is in the list of known typos
function checkTypo(value) {
	var typoObj = findObjectByProperties(typos, {"incorrect": value});
	if (typeof typoObj !== 'undefined') return typoObj.correct;
	else return value;
}

// look for potential typos in the yaml mappings
async function findMatrixTypos() {
	var incorrects = new Array();
	var questions = new Array();
	
	const mp = metadata.mappings;
	mp.forEach(function(mapping) {
	//check for arrays Array.isArray(obj)
	//handle intersection objects
		const functionalNeeds = (typeof mapping['functional-need'] === 'string' || (typeof mapping['functional-need'] === 'object' && !Array.isArray(mapping['functional-need']))) ? [mapping['functional-need']] : mapping['functional-need'];
		const userNeeds = (typeof mapping['user-need'] === 'string') ? [mapping['user-need']] : mapping['user-need'];
		const userNeedRelevances = (typeof mapping['user-need-relevance'] === 'string') ? [mapping['user-need-relevance']] : mapping['user-need-relevance'];
		
		functionalNeeds.forEach(function(functionalNeed) {
			if (typeof functionalNeed === 'object') {
				checkEach(functionalNeedList, functionalNeed.intersection[0]);
				checkEach(functionalNeedList, functionalNeed.intersection[1]);
			} else checkEach(functionalNeedList, functionalNeed);
			userNeeds.forEach(function(userNeed) {
				checkEach(userNeedList, userNeed);
				userNeedRelevances.forEach(function(userNeedRelevance) {
					checkEach(userNeedRelevanceList, userNeedRelevance);
				});
			});
		});
	});
	
	function checkEach(list, label) {
		if (!compareStr(label, 'all')) {
			if (typeof findObjectByProperties(list, {"label": label}) === 'undefined' && typeof findObjectByProperties(typos, {"incorrect": label}) === 'undefined') {
				incorrects.push([label, list]);
			}
		}
	}
		
	//todo: remove duplicates from the array before proceeding
	if (incorrects.length > 0) {
		incorrects.forEach(function(inc, index) {
			questions.push(makeInquirerQuestion("q" + index, inc[0], inc[1]));
		});
	
		const answers = await inquirer.prompt(questions).then((answers) => answers);
		for (var i = 0; i < questions.length; i++) {
			typos.push({"incorrect": incorrects[i][0], "correct": answers["q"+i]});
		}
		
		writeFile(typosPath, JSON.stringify(typos));
	}
}

// send typos to the inquirer prompt
async function promptTypoCorrections(questions) {
	await inquirer.prompt(questions).then((answer) => {
		return answer;
  	});
}

// inquirer
function makeInquirerQuestion(qId, label, arr) {
	var q = {
    	type: "rawlist",
    	name: qId,
    	message: "Unable to find '" + label + "'. Please select the correct item from the list.",
    	choices: getOneProp(arr, 'label'),
    	waitUserInput: true,
    	loop: false
  };
  return q;
}

async function checkReimport(contentIri) {
	const sparql = 'select ?id ?label where { ?id a11y:contentIRI <' + contentIri + '> ; rdfs:label ?label }';
	const result = await dbquery.selectQuery(sparql);
	if (result.results.bindings.length > 0) {
		const id = idFrag(result.results.bindings[0].id.value);
		const label = result.results.bindings[0].label.value;
		const replace = await inquirer.prompt([{"type": "confirm", "name": "replace", "message": "Do you want to reimport " + label + "?", }]).then((answer) => answer.replace); 
		if (!replace) return false;
		else {
			await deleteStatement(id);
			return id;
		}
	} else return null;
}

async function deleteStatement(id) {
	const updateSparql1 = 'delete where { :' + id + ' a11y:references ?s . ?s ?p ?o}';
	const updateSparql2 = 'delete where { :' + id + ' ?p ?o }';
	await dbquery.updateQuery(updateSparql1);
	await dbquery.updateQuery(updateSparql2);
}