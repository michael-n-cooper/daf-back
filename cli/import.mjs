import { readFile, writeFile } from 'node:fs/promises';
import parseMD from 'parse-md';
import * as dbquery from '../script/dbquery.mjs';
import { findObjectByProperties, compareStr, normalizeStr, isValidUrl, getOneProp, getFileData, escSparql, apiGet } from '../script/util.mjs';
import inquirer from 'inquirer';
import * as commonmark from 'commonmark';
import { v4 as uuid } from 'uuid';

//#region global
const importDir = '../../../accessiblecommunity/Digital-Accessibility-Framework/';
const typosPath = './typos.json';
const contentIriBase = 'https://github.com/accessiblecommunity/Digital-Accessibility-Framework/';
const idBase = "https://github.com/michael-n-cooper/a11y-data/daf/#";

var fileMeta, fileContent;
var functionalNeedList, intersectionNeedList, userNeedList, userNeedContextList, referenceTypes, tags, dbMappingIds; // ids of the mapping objects corresponding to the above
var functionalAbilityList, accommodationTypeList, accessibilityCharacteristicList, simpleCurveMaps;
var knownMatrix;
var typos;
var foundTypos = new Array();
var importFileName, data;
//#endregion

//#region load file
async function loadFile() {
	const ifn = 'input-modality-choice.md';//await inquirer.prompt([{ "name": "fileName", "message": "File to import:", }]).then((answer) => answer.fileName);
	const dt = await getFileData(importDir + ifn);
	// need to catch bad file name
	if (dt == null) {
		// check if file previously imported but deleted
		let sparql = 'select ?id where { ?id a11y:contentIRI <' + contentIriBase + ifn + '> }';
		let result = await dbquery.selectQuery(sparql);
		// previously imported
		if (result.length > 0) {
			let todel = await checkDataDelete(ifn);
			if (!todel) {
				console.log("Aborting");
			}
		}
		// bad file name
		else {
			console.log("Unable to find file \"" + ifn + "\"");
		}
		process.exit(0);
	}
	importFileName = ifn;
	data = dt;

	const { metadata, content } = parseMD(data);
	fileMeta = metadata;
	fileContent = content;
}
//#endregion

//region load references
async function loadReferenceLists() {
	functionalNeedList = await apiGet("functional-needs");
	intersectionNeedList = await apiGet("intersection-needs");
	userNeedList = await apiGet("user-needs");
	userNeedContextList = await apiGet("user-need-contexts");
	referenceTypes = await lookupIdLabels("ReferenceType");
	tags = await apiGet("tags");
	dbMappingIds = await apiGet("mappings"); // ids of the mapping objects corresponding to the above

	functionalAbilityList = await apiGet("functional-abilities");
	accommodationTypeList = await apiGet("accommodation-types");
	accessibilityCharacteristicList = await apiGet("accessibility-characteristics");
	simpleCurveMaps = await apiGet("simple-curve-maps")

	knownMatrix = [{ "listname": "accommodation-types", "list": accommodationTypeList }, { "listname": "accessibility-characteristics", "list": accessibilityCharacteristicList }, { "listname": "functional-abilities", "list": functionalAbilityList }, { "listname": "functional-needs", "list": functionalNeedList }, { "listname": "intersection-needs", "list": intersectionNeedList }, { "listname": "user-needs", "list": userNeedList }, { "listname": "user-need-contexts", "list": userNeedContextList }];

	typos = await loadTypos();
}
//#endregion

export async function run() {

await loadFile();

await loadReferenceLists();

await processTypos();

//#region Process data
const expandedMappings = await expandMappings(fileMeta);
const expandedAccommtypeMappings = await expandAccomtypeMappings(fileMeta);

const tagsArr = fileMeta.tags ? fileMeta.tags : new Array(); // retrieve tags
const { research, guidelines } = retrieveReferences(fileMeta); // retrieve references, divide into research and guidelines
const { title, statement, notes } = retrieveContent(fileContent); // retrieve title and statement
//#endregion

//#region Build sparql
// check for previous
let stmtId = await checkDataDelete(contentIriBase + importFileName);

if (stmtId != false) {

	// construct the sparql statement
	if (stmtId == null) stmtId = idBase + uuid();
	let sparql = 'insert data { <' + stmtId + '> a a11y:AccessibilityStatement ; a owl:NamedIndividual ';
	sparql += ' ; a11y:stmtGuidance "' + escSparql(statement) + '"@en';
	sparql += ' ; rdfs:label "' + escSparql(title) + '"@en';
	if (notes.length > 0) sparql += ' ; a11y:note "' + escSparql(notes) + '"@en';
	sparql += ' ; a11y:contentIRI <' + contentIriBase + importFileName + ">";
	expandedMappings.forEach(function (mapping) {
		sparql += ' ; a11y:supports <' + mapping.id + '>';
	});
	expandedAccommtypeMappings.forEach(function (mapping) {
		sparql += ' ; a11y:supports <' + mapping.id + '>';
	});
	tagsArr.forEach(function (tag) {
		sparql += ' ; a11y:tags <' + getIdByLabel(tags, tag, 'Tag') + '>';
	});
	if (research.length > 0) {
		research.forEach(function (link) {
			const linkId = idBase + uuid();
			sparql += ' . <' + linkId + '> a a11y:Reference ; a11y:refIRI <' + link.uri + '> ; a11y:refNote "' + escSparql(link.note) + '"@en ; a11y:refType <' + getIdByLabel(referenceTypes, 'research', 'ReferenceType') + '>';
			sparql += ' . <' + stmtId + '> a11y:references <' + linkId + '>';
		});
	}
	if (guidelines.length > 0) {
		guidelines.forEach(function (link) {
			const linkId = idBase + uuid();
			sparql += ' . <' + linkId + '> a a11y:Reference ; a11y:refIRI <' + link.uri + '> ; a11y:refNote "' + escSparql(link.note) + '"@en ; a11y:refType <' + getIdByLabel(referenceTypes, 'guidelines', 'ReferenceType') + '>';
			sparql += ' . <' + stmtId + '> a11y:references <' + linkId + '>';
		});
	}
	sparql += ' }';
	//console.log(sparql);
	//const importResult = await dbquery.updateQuery(sparql);
	//console.log(JSON.stringify(importResult));
} else console.log("Aborting");
}
//#endregion

//#region matrix dimensions (functional needs, user needs, relevances)
function getMatrixDimId(listname, label) {
	// check against list of known typos, correct

	/**
	 * uncomment this
	 */
	//label = correctPotentialTypo(listname, label);

	let matrixListObj = findObjectByProperties(knownMatrix, { "listname": listname });
	if (typeof matrixListObj !== 'undefined') {
		let matrixDimId = findObjectByProperties(matrixListObj.list, { "label": label });
		return matrixDimId.id;
	} else return null;
}

// find an intersection need in the local array from 2 functional need ids
function getIntersectionNeedId(fn1, fn2) {
	var inId;
	const intersection = findObjectByProperties(intersectionNeedList, { "fn1": fn1, "fn2": fn2 });

	if (typeof intersection === 'undefined') {
		inId = idBase + uuid();
		const label1 = findObjectByProperties(functionalNeedList, { "id": fn1 }).label;
		const label2 = findObjectByProperties(functionalNeedList, { "id": fn2 }).label;
		const update = 'insert data { <' + inId + '> a a11y:IntersectionNeed ; a11y:supports <' + fn1 + '> ; a11y:supports <' + fn2 + '> ; rdfs:label "' + label1 + " and " + label2 + '"@en}';
		dbquery.updateQuery(update);
	} else {
		inId = intersection.id;
	}
	return inId;
}
//#endregion

//#region Mappings
// accommodation type mappings
async function expandAccomtypeMappings() {
	let result = new Array();
	const mappings = fileMeta["accomtype-mappings"];

	mappings.forEach(function (mapping) {
		// check for keyword "all"
		if (typeof mapping['functional-ability'] === 'string' && compareStr(mapping['functional-ability'], "all")) mapping['functional-ability'] = getOneProp(functionalAbilityList, 'label');
		if (typeof mapping['accommodation-type'] === 'string' && compareStr(mapping['accommodation-type'], "all")) mapping['accommodation-type'] = getOneProp(accommodationTypeList, 'label');
		if (typeof mapping['accessibility-characteristic'] === 'string' && compareStr(mapping['accessibility-characteristic'], "all")) mapping['accessibility-characteristic'] = getOneProp(accessibilityCharacteristicList, 'label');

		// make sure the values are arrays
		const functionalAbilities = (typeof mapping['functional-ability'] === 'string' || (typeof mapping['functional-ability'] === 'object' && !Array.isArray(mapping['functional-ability']))) ? [mapping['functional-ability']] : mapping['functional-ability'];
		const accommodationTypes = (typeof mapping['accommodation-type'] === 'string') ? [mapping['accommodation-type']] : mapping['accommodation-type'];
		const accessibilityCharacteristics = (typeof mapping['accessibility-characteristic'] === 'string') ? [mapping['accessibility-characteristic']] : mapping['accessibility-characteristic'];

		// expand out arrays of mapped items
		functionalAbilities.forEach(function (functionalAbility) {
			const functionalAbilityId = getMatrixDimId(knownMatrix, "functional-abilities", functionalAbility);
			accommodationTypes.forEach(function (accommodationType) {
				const accommodationTypeId = getMatrixDimId(knownMatrix, "accommodation-types", accommodationType);
				accessibilityCharacteristics.forEach(function (accessibilityCharacteristic) {
					const accessibilityCharacteristicId = getMatrixDimId(knownMatrix, "accessibility-characteristics", accessibilityCharacteristic);
					result.push({ "functionalAbility": functionalAbilityId, "accommodationType": accommodationTypeId, "accessibilityCharacteristic": accessibilityCharacteristicId });
				});
			});
		});
	});

	let returnVal = new Array();
	result.forEach(async function (mapping) {
		let mappingId = await getAccommTypeMappingId(mapping);
		returnVal.push({ id: mappingId, mapping: mapping});
	});

	return (returnVal);
}

// matrix mappings
async function expandMappings() {
	let result = new Array();
	const mappings = fileMeta.mappings;
	
	mappings.forEach(function (mapping) {
		// check for keyword "all"
		if (typeof mapping['functional-need'] === 'string' && compareStr(mapping['functional-need'], "all")) mapping['functional-need'] = getOneProp(functionalNeedList, 'label');
		if (typeof mapping['user-need'] === 'string' && compareStr(mapping['user-need'], "all")) mapping['user-need'] = getOneProp(userNeedList, 'label');
		if (typeof mapping['user-need-relevance'] === 'string' && compareStr(mapping['user-need-relevance'], "all")) mapping['user-need-relevance'] = getOneProp(userNeedContextList, 'label');

		// make sure the values are arrays
		const functionalNeeds = (typeof mapping['functional-need'] === 'string' || (typeof mapping['functional-need'] === 'object' && !Array.isArray(mapping['functional-need']))) ? [mapping['functional-need']] : mapping['functional-need'];
		const userNeeds = (typeof mapping['user-need'] === 'string') ? [mapping['user-need']] : mapping['user-need'];
		const userNeedRelevances = (typeof mapping['user-need-relevance'] === 'string') ? [mapping['user-need-relevance']] : mapping['user-need-relevance'];

		// expand out arrays of mapped items
		functionalNeeds.forEach(function (functionalNeed) {
			var functionalNeedId;
			var fnType = "FunctionalNeed";
			if (typeof functionalNeed === 'object') {
				const fn1 = getMatrixDimId(knownMatrix, "functional-needs", functionalNeed.intersection[0]);
				const fn2 = getMatrixDimId(knownMatrix, "functional-needs", functionalNeed.intersection[1]);
				functionalNeedId = getIntersectionNeedId(knownMatrix, fn1, fn2);
				fnType = "IntersectionNeed"
			} else functionalNeedId = getMatrixDimId(knownMatrix, "functional-needs", functionalNeed);
			userNeeds.forEach(function (userNeed) {
				const userNeedId = getMatrixDimId(knownMatrix, "user-needs", userNeed);
				userNeedRelevances.forEach(function (userNeedRelevance) {
					const userNeedRelevanceId = getMatrixDimId(knownMatrix, "user-need-contexts", userNeedRelevance);
					result.push({ [fnType]: functionalNeedId, "UserNeed": userNeedId, "UserNeedRelevance": userNeedRelevanceId });
				});
			});
		});
	});

	let returnVal = new Array();
	result.forEach(async function (mapping) {
		let mappingId = await getMappingId(mapping);
		returnVal.push({ id: mappingId, mapping: mapping})
	});

	return (returnVal);
}

// get a single mapping object from the stored array, or add one if not exists
async function getMappingId(mapping) {
	var functionalNeedId = (mapping.FunctionalNeed || mapping.IntersectionNeed);
	var result = findObjectByProperties(dbMappingIds, { "fnId": functionalNeedId, "unId": mapping.UserNeed, "unrId": mapping.UserNeedRelevance });
	if (typeof result === 'undefined') {
		var mapType = "MatrixMapping";
		if (typeof mapping.FunctionalNeed === 'undefined') mapType = "IntersectionMapping";
		const id = idBase + uuid();
		const update = 'insert data { <' + id + '> a a11y:' + mapType + ' ; a owl:NamedIndividual ; a11y:supports <' + functionalNeedId + '> ; a11y:supports <' + mapping.UserNeed + '> ; a11y:supports <' + mapping.UserNeedRelevance + '> }';
		await dbquery.updateQuery(update);
		return (idBase + id);
	} else {
		return result.id;
	}
}

async function getAccommTypeMappingId(mapping) {
	//console.log(mapping);
	var result = findObjectByProperties(simpleCurveMaps, { "abilityId": mapping.functionalAbility, "accommId": mapping.accommodationType, "charId": mapping.accessibilityCharacteristic });
	if (typeof result === 'undefined') {
		const id = idBase + uuid();
		const update = 'insert data { <' + id + '> a a11y:SimpleCurveMap ; a owl:NamedIndividual ; a11y:supports <' + mapping.functionalAbility + '> ; a11y:supports <' + mapping.accommodationType + '> ; a11y:supports <' + mapping.accessibilityCharacteristic + '> }';
		await dbquery.updateQuery(update);
		return (idBase + id);
	} else {
		return result.id;
	}
}
//#endregion

//#region general

// get the id for a label on a class, add it to the database if not found
function getIdByLabel(arr, label, addClass) {
	var id = null;

	const idObj = findObjectByProperties(arr, { "label": label });
	if (typeof idObj !== 'undefined') id = idObj.id;

	if (id == null && addClass !== undefined) {
		id = idBase + uuid();
		const updateSparql = 'insert data { <' + id + '> a a11y:' + addClass + ' ; rdfs:label "' + label + '"@en }';
		dbquery.updateQuery(updateSparql);
	}

	return id;
}

// get an array of {id, label} for a class
async function lookupIdLabels(type) {
	var returnval = new Array();
	const sparql = 'select ?id ?label where { ?id a a11y:' + type + ' ; rdfs:label ?label } order by ?label';
	const results = await dbquery.selectQuery(sparql);
	if (results.length > 0) {
		results.forEach(function (result) {
			returnval.push({ id: result.id, label: result.label });
		});
	}
	return returnval;
}

async function checkDataDelete(importFileName = null) {
	let contentIri = contentIriBase + importFileName;
	const sparql = 'select ?id ?label where { ?id a11y:contentIRI <' + contentIri + '> ; rdfs:label ?label }';
	const result = await dbquery.selectQuery(sparql);
	if (result.length > 0) {
		let message = importFileName == null ? "The file \"" + importFileName + "\" was previously imported but cannot be found. Do you want to delete data from this file?" : "Do you want to reimport " + label + "?";

		const id = result[0].id;
		const label = result[0].label;
		const replace = await inquirer.prompt([{ "type": "confirm", "name": "replace", "message": message }]).then((answer) => answer.replace);
		if (!replace) return false;
		else {
			await deleteStatement(id);
			console.log("Deleted " + importFileName);
			return id;
		}
	} else return null;
}

async function deleteStatement(id) {
	const updateSparql1 = 'delete where { <' + id + '> a11y:references ?s . ?s ?p ?o}';
	const updateSparql2 = 'delete where { <' + id + '> ?p ?o }';
	await dbquery.updateQuery(updateSparql1);
	await dbquery.updateQuery(updateSparql2);
}
//#endregion

//#region content
// references
function retrieveReferences(fileMeta) {
	var research = new Array();
	var guidelines = new Array();
	if (fileMeta.references) {
		const references = fileMeta.references;

		references.forEach(function (referenceType) {
			if (referenceType.research !== undefined && Array.isArray(referenceType.research)) {
				referenceType.research.forEach(function (ref) {
					if (Array.isArray(ref) && isValidUrl(ref[0])) research.push({ "uri": ref[0], "note": ref.slice(1).join(", ") });
				});
			}
			if (referenceType.guidelines !== undefined && Array.isArray(referenceType.guidelines)) {
				referenceType.guidelines.forEach(function (ref) {
					if (Array.isArray(ref) && isValidUrl(ref[0])) guidelines.push({ "uri": ref[0], "note": ref.slice(1).join(", ") });
				});
			}
		});

	}

	return { "research": research, "guidelines": guidelines };
}

// content
function retrieveContent(fileContent) {
	let reader = new commonmark.Parser();
	let parsed = reader.parse(fileContent);
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
//#endregion

//#region Typo handling
// process typos
async function processTypos() {
	await findMatrixTypos(fileMeta);
	await promptTypoCorrections();
	}
	
// load list of typos
async function loadTypos() {
	try {
		const contents = await readFile(typosPath, { encoding: 'utf8' });
		let typosObj = JSON.parse(contents);

		/*
		knownMatrix.forEach(function (list) {
			if (!findObjectByProperties(typos, { "listname": list.listname })) typosObj.push({ "listname": [] });
		});
		*/
		return (typosObj);
	} catch (err) {
		console.error("loadTypos: " + err.message);
	}
}

// add a typo to the list
function storeTypo(listname, inc, cor) {
	let listForTypo = findObjectByProperties(typos, { "listname": listname })
	listForTypo.push({ incorrect: inc, correct: cor });
}

// save the list of typos
async function saveTypos() {
	try {
		//await writeFile(typosPath, JSON.stringify(typos), { encoding: 'utf8' });
	} catch (err) {
		console.error(err);
	}
}

// check if a value is in the list of known typos
function correctPotentialTypo(listname, value) {
	let typoList = findObjectByProperties(typos, { "listname": listname });
	if (typeof typoList !== 'undefined') {
		let typoObj = findObjectByProperties(typoList, { "incorrect": value });
		if (typeof typoObj !== 'undefined') return typoObj.correct;
	}
	else return value;
}

// look for potential typos in the yaml mappings
async function findMatrixTypos() {
	const mp = fileMeta.mappings;
	mp.forEach(function (mapping) {
		//check for arrays Array.isArray(obj)
		//handle intersection objects
		const functionalNeeds = (typeof mapping['functional-need'] === 'string' || (typeof mapping['functional-need'] === 'object' && !Array.isArray(mapping['functional-need']))) ? [mapping['functional-need']] : mapping['functional-need'];
		const userNeeds = (typeof mapping['user-need'] === 'string') ? [mapping['user-need']] : mapping['user-need'];
		const userNeedRelevances = (typeof mapping['user-need-relevance'] === 'string') ? [mapping['user-need-relevance']] : mapping['user-need-relevance'];

		functionalNeeds.forEach(function (functionalNeed) {
			if (typeof functionalNeed === 'object') {
				checkPotentialTypo("functional-needs", functionalNeed.intersection[0]);
				checkPotentialTypo("functional-needs", functionalNeed.intersection[1]);
			} else checkPotentialTypo("functional-needs", functionalNeed);
			userNeeds.forEach(function (userNeed) {
				checkPotentialTypo("user-needs", userNeed);
				userNeedRelevances.forEach(function (userNeedRelevance) {
					checkPotentialTypo("user-need-contexts", userNeedRelevance);
				});
			});
		});
	});

	const accomTypeMappings = fileMeta["accomtype-mappings"];
	accomTypeMappings.forEach(function (mapping) {
		const functionalAbilities = (typeof mapping['functional-ability'] === 'string') ? [mapping['functional-ability']] : mapping['functional-ability'];
		const accommodationTypes = (typeof mapping['accommodation-type'] === 'string') ? [mapping['accommodation-type']] : mapping['accommodation-type'];
		const accessibilityCharacteristics = (typeof mapping['accessibility-characteristic'] === 'string') ? [mapping['accessibility-characteristic']] : mapping['accessibility-characteristic'];

		functionalAbilities.forEach(function (functionalAbility) {
			checkPotentialTypo("functional-abilities", functionalAbility);
			accommodationTypes.forEach(function (accommodationType) {
				checkPotentialTypo("accommodation-types", accommodationType);
				accessibilityCharacteristics.forEach(function (accessibilityCharacteristic) {
					checkPotentialTypo("accessibility-characteristics", accessibilityCharacteristic);
				});
			});
		});
	});

}

function checkPotentialTypo(listname, label) {
	let found = false;
	// check for known typo, get sublist then check that
	let typoList = findObjectByProperties(knownMatrix, { "listname": listname });
	if (typeof typoList !== 'undefined' && typeof findObjectByProperties(typoList.list, { "label": label }) === 'undefined') found = true;
	// check for already checked typo
	let typoCorrectedList = findObjectByProperties(foundTypos, { "listname": listname, "incorrect": label });
	if (typeof typoCorrectedList !== 'undefined') found = true;

	if (found) foundTypos.push({ "listname": listname, "incorrect": label });
}

async function promptTypoCorrections() {
	let questions = new Array();
	let questionLists = new Array();

	foundTypos.forEach(function (typo, index) {
		let qid = "q" + index;
		questionLists[qid] = typo.listname;
		questions.push(makeInquirerQuestion(qid, typo.incorrect, typo.listname));
	});

	const answers = await inquirer.prompt(questions).then((answers) => answers);
	for (var i = 0; i < questions.length; i++) {
		let qid = "q" + i;
		let listname = questionLists[qid];
		storeTypo(listname, answers[qid]);
	}

	saveTypos();
}

//#endregion

//#region Inquirer
// inquirer
function makeInquirerQuestion(qId, label, listname) {

	let arr = findObjectByProperties(knownMatrix, { "listname": listname }).list;
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
//#endregion

await run();