import { readFile, writeFile, appendFile, readdir } from 'node:fs/promises';
import parseMD from 'parse-md';
import * as dbquery from '../script/dbquery.mjs';
import { findObjectByProperties, compareStr, normalizeStr, isValidUrl, getOneProp, getFileData, escSparql, apiGet } from '../script/util.mjs';
import inquirer from 'inquirer';
import * as commonmark from 'commonmark';
import { v4 as uuid } from 'uuid';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scheduler } from 'node:timers/promises';

//#region global
const importDir = '../../../accessiblecommunity/Digital-Accessibility-Framework/';
const typosPath = './typos.json';
const contentIriBase = 'https://github.com/accessiblecommunity/Digital-Accessibility-Framework/';
const idBase = "https://github.com/michael-n-cooper/a11y-data/daf/#";

var functionalNeedList, intersectionNeedList, userNeedList, userNeedContextList, referenceTypes, tags, dbMappingIds; // ids of the mapping objects corresponding to the above
var functionalAbilityList, accommodationTypeList, accessibilityCharacteristicList, simpleCurveMaps;
var knownMatrix;
var typoCorrectedList = [];
var foundTypos = [];
//#endregion

async function run() {
	await loadReferenceLists();

	const answers = await inquirer.prompt([{ name: "mode", message: "Import single file or directory?", type: "list", choices: [{ name: "File", value: "file" }, { "name": "Dir", "value": "dir" }] }, { name: "path", message: "File or directory name:" }]);

	const foldersPath = pathToFileURL(importDir).href.replace('///', '//');

	let fileNames;
	if (answers.mode == "file") fileNames = [answers.path];
	else fileNames = await readdir(fileURLToPath(foldersPath));

	for await (let fileName of fileNames) {
		try {
			console.log("Processing " + fileName);
			let fileData = await loadFile(fileURLToPath(foldersPath) + fileName, fileName, answers.mode == "file" ? true : false);
			if (fileData == null) throw new Error("Unable to load " + fileName);

			await processFile(fileData);
			await scheduler.wait(1000);
		} catch (error) {
			console.error(error.message);
			console.error(error.trace);
			await appendFile("./errors.txt", fileName + "\n");
		}
	};
	console.log("Done");
}

//#region load file
async function loadFile(filePath, fileName, checkReimport) {
	let stmtId = null;
	const fileData = await getFileData(filePath);
	const existing = await stmtIdFromFilename(fileName);

	// file missing
	if (fileData == null) {
		// check if there is related data that you want to delete
		if (existing.length > 0) {
			let toDel = await checkDataDelete(fileName);
			if (toDel) {
				await deleteStatement(existing[0].id);
				console.log("Deleted " + existing.label);
				return null;
			} else {
				console.log("Skipping delete of " + fileName);
				return null;
			}
		} else {
			console.log("Invalid filename " + fileName);
			return null;
		}
	}

	//check reimport
	if (existing.length > 0) {
		stmtId = existing[0].id;
		let toReimport = true;
		if (checkReimport) {
			toReimport = await checkDataReimport(fileName);
		}
		if (!toReimport) {
			console.log("Skipping reimport of " + fileName);
			return null;
		}
	}

	if (stmtId == null) stmtId = idBase + uuid();

	const parsed = parseMD(fileData);
	return { stmtId: stmtId, fileName: fileName, metadata: parsed.metadata, content: parsed.content };
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
	simpleCurveMaps = await apiGet("simple-curve-maps");

	knownMatrix = [{ "listname": "accommodation-types", "list": accommodationTypeList }, { "listname": "accessibility-characteristics", "list": accessibilityCharacteristicList }, { "listname": "functional-abilities", "list": functionalAbilityList }, { "listname": "functional-needs", "list": functionalNeedList }, { "listname": "intersection-needs", "list": intersectionNeedList }, { "listname": "user-needs", "list": userNeedList }, { "listname": "user-need-contexts", "list": userNeedContextList }];

	await loadTypos();
}
//#endregion

export async function processFile(fileData) {
	let stmtId = fileData.stmtId;
	let importFileName = fileData.fileName;
	let fileMeta = fileData.metadata;
	let fileContent = fileData.content;

	await processTypos(fileMeta);

	//#region Process data
	const expandedMappings = await expandMappings(fileMeta);
	const expandedAccommtypeMappings = await expandAccommtypeMappings(fileMeta);

	const tagsArr = fileMeta.tags ? fileMeta.tags : []; // retrieve tags
	const { research, guidelines } = retrieveReferences(fileMeta); // retrieve references, divide into research and guidelines
	const { title, statement, notes } = retrieveContent(fileContent); // retrieve title and statement
	//#endregion

	//#region Build sparql

	// construct the sparql statement
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
	await deleteStatement(stmtId);
	//console.log(sparql);
	const importResult = await dbquery.updateQuery(sparql);
	console.log(JSON.stringify(importResult));
	return true;
}
//#endregion

//#region matrix dimensions (functional needs, user needs, relevances)
function getMatrixDimId(listname, label) {
	// check against list of known typos, correct
	let correctLabel = getCorrectLabel(listname, label);
	let matrixListObj = findObjectByProperties(knownMatrix, { "listname": listname });
	if (typeof matrixListObj !== 'undefined') {
		let matrixDimId = findObjectByProperties(matrixListObj.list, { "label": correctLabel });
		return matrixDimId.id;
	} else return null;
}

// find an intersection need in the local array from 2 functional need ids
function getIntersectionNeedId(fn1, fn2) {
	var inId;
	const intersection = intersectionNeedList.find((obj) => { if (obj.fn1 == fn1 && obj.fn2 == fn2) return true; else return false; });

	if (typeof intersection === 'undefined') {
		inId = idBase + uuid();
		const label1 = findObjectByProperties(functionalNeedList, { "id": fn1 }).label;
		const label2 = findObjectByProperties(functionalNeedList, { "id": fn2 }).label;
		const update = 'insert data { <' + inId + '> a a11y:IntersectionNeed ; a11y:supports <' + fn1 + '> ; a11y:supports <' + fn2 + '> ; rdfs:label "' + label1 + " and " + label2 + '"@en}';
		dbquery.updateQuery(update);
		intersectionNeedList.push({ id: inId, label: label1 + " and " + label2, fn1: fn1, fn2: fn2 });
	} else {
		inId = intersection.id;
	}
	return inId;
}
//#endregion

//#region Mappings
// accommodation type mappings
async function expandAccommtypeMappings(fileMeta) {
	let result = [];
	const mappings = fileMeta["accomtype-mappings"];
	if (typeof mappings === "undefined") return;
	if (typeof (mappings.find((mapping) => mapping["intersection"])) !== "undefined") throw new Error("Skipping intersections");

	mappings.forEach(function (mapping) {
		// make sure the values are arrays
		const functionalAbilities = (typeof mapping['functional-ability'] === 'string') ? [mapping['functional-ability']] : mapping['functional-ability'];
		const accommodationTypes = (typeof mapping['accommodation-type'] === 'string') ? [mapping['accommodation-type']] : mapping['accommodation-type'];
		const accessibilityCharacteristics = (typeof mapping['accessibility-characteristic'] === 'string') ? [mapping['accessibility-characteristic']] : mapping['accessibility-characteristic'];

		// expand out arrays of mapped items
		functionalAbilities.forEach(function (functionalAbility) {
			const functionalAbilityId = getMatrixDimId("functional-abilities", getCorrectLabel("functional-abilities", functionalAbility));
			accommodationTypes.forEach(function (accommodationType) {
				const accommodationTypeId = getMatrixDimId("accommodation-types", getCorrectLabel("accommodation-types", accommodationType));
				accessibilityCharacteristics.forEach(function (accessibilityCharacteristic) {
					const accessibilityCharacteristicId = getMatrixDimId("accessibility-characteristics", getCorrectLabel("accessibility-characteristics", accessibilityCharacteristic));
					result.push({ "abilityId": functionalAbilityId, "accommId": accommodationTypeId, "charId": accessibilityCharacteristicId });
				});
			});
		});
	});

	var returnVal = [];
	for await (let mapping of result) {
		let mappingId = await getAccommTypeMappingId(mapping);
		returnVal.push({ id: mappingId, mapping: mapping });
	};

	return (returnVal);
}

// matrix mappings
async function expandMappings(fileMeta) {
	let result = [];
	const mappings = fileMeta.mappings;
	if (typeof mappings === "undefined") return;

	mappings.forEach(function (mapping) {
		// make sure the values are arrays
		const functionalNeeds = (typeof mapping['functional-need'] === 'string' || (typeof mapping['functional-need'] === 'object' && !Array.isArray(mapping['functional-need']))) ? [mapping['functional-need']] : mapping['functional-need'];
		const userNeeds = (typeof mapping['user-need'] === 'string') ? [mapping['user-need']] : mapping['user-need'];
		const userNeedRelevances = (typeof mapping['user-need-relevance'] === 'string') ? [mapping['user-need-relevance']] : mapping['user-need-relevance'];

		// expand out arrays of mapped items
		functionalNeeds.forEach(function (functionalNeed) {
			var functionalNeedId;
			var fnType = "FunctionalNeed";
			if (typeof functionalNeed === 'object') {
				const fn1 = getMatrixDimId("functional-needs", getCorrectLabel("functional-needs", functionalNeed.intersection[0]));
				const fn2 = getMatrixDimId("functional-needs", getCorrectLabel("functional-needs", functionalNeed.intersection[1]));
				functionalNeedId = getIntersectionNeedId("intersection-needs", fn1, fn2);
				fnType = "IntersectionNeed";
			} else functionalNeedId = getMatrixDimId("functional-needs", getCorrectLabel("functional-needs", functionalNeed));
			userNeeds.forEach(function (userNeed) {
				const userNeedId = getMatrixDimId("user-needs", getCorrectLabel("user-needs", userNeed));
				userNeedRelevances.forEach(function (userNeedRelevance) {
					const userNeedRelevanceId = getMatrixDimId("user-need-contexts", getCorrectLabel("user-need-contexts", userNeedRelevance));
					result.push({ [fnType]: functionalNeedId, "UserNeed": userNeedId, "UserNeedRelevance": userNeedRelevanceId });
				});
			});
		});
	});

	let returnVal = [];
	for await (let mapping of result) {
		let mappingId = await getMappingId(mapping);
		returnVal.push({ id: mappingId, mapping: mapping })
	};

	return (returnVal);
}

// get a single mapping object from the stored array, or add one if not exists
async function getMappingId(mapping) {
	var functionalNeedId = (mapping.FunctionalNeed || mapping.IntersectionNeed);
	var result = dbMappingIds.find((obj) => { if (obj.fnId == functionalNeedId && obj.unId == mapping.UserNeed && obj.unrId == mapping.UserNeedRelevance) return true; else return false; });
	if (typeof result === 'undefined') {
		var mapType = "MatrixMapping";
		if (typeof mapping.FunctionalNeed === 'undefined') mapType = "IntersectionMapping";
		const id = idBase + uuid();
		const update = 'insert data { <' + id + '> a a11y:' + mapType + ' ; a owl:NamedIndividual ; a11y:supports <' + functionalNeedId + '> ; a11y:supports <' + mapping.UserNeed + '> ; a11y:supports <' + mapping.UserNeedRelevance + '> }';
		await dbquery.updateQuery(update);
		dbMappingIds.push({ id: id, fnId: functionalNeedId, unId: mapping.UserNeed, unrId: mapping.UserNeedRelevance });
		return (id);
	} else {
		return result.id;
	}
}

async function getAccommTypeMappingId(mapping) {
	var result = simpleCurveMaps.find((map) => { if (map.abilityId == mapping.abilityId && map.accommId == mapping.accommId && map.charId == mapping.charId) return true; else return false; });
	if (typeof result === 'undefined') {
		const id = idBase + uuid();
		const update = 'insert data { <' + id + '> a a11y:SimpleCurveMap ; a owl:NamedIndividual ; a11y:supports <' + mapping.abilityId + '> ; a11y:supports <' + mapping.accommId + '> ; a11y:supports <' + mapping.charId + '> }';
		await dbquery.updateQuery(update);
		simpleCurveMaps.push({ id: id, abilityId: mapping.abilityId, accommId: mapping.accommId, charId: mapping.charId });
		return (id);
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
		arr.push({ id: id, label: label });
	}

	return id;
}

// get an array of {id, label} for a class
async function lookupIdLabels(type) {
	var returnval = [];
	const sparql = 'select ?id ?label where { ?id a a11y:' + type + ' ; rdfs:label ?label } order by ?label';
	const results = await dbquery.selectQuery(sparql);
	if (results.length > 0) {
		results.forEach(function (result) {
			returnval.push({ id: result.id, label: result.label });
		});
	}
	return returnval;
}

async function checkDataDelete(importFileName) {
	const message = "The file \"" + importFileName + "\" was previously imported but cannot be found. Do you want to delete data from this file?";

	const del = await inquirer.prompt([{ "type": "confirm", "name": "delete", "message": message }]).then((answer) => answer.delete);
	return del;
}

async function checkDataReimport(importFileName) {
	const message = "The file \"" + importFileName + "\" was previously imported. Do you want to update data from this file?";

	const reimport = await inquirer.prompt([{ "type": "confirm", "name": "delete", "message": message }]).then((answer) => answer.delete);
	return reimport;
}

async function stmtIdFromFilename(importFileName) {
	const contentIri = contentIriBase + importFileName;
	const sparql = 'select ?id ?label where { ?id a11y:contentIRI <' + contentIri + '> ; rdfs:label ?label }';
	const result = await dbquery.selectQuery(sparql);
	return result;
}

async function deleteStatement(id) {
	console.log("Deleting " + id);
	const updateSparql1 = 'delete where { <' + id + '> a11y:references ?s . ?s ?p ?o}';
	const updateSparql2 = 'delete where { <' + id + '> ?p ?o }';
	await dbquery.updateQuery(updateSparql1);
	await dbquery.updateQuery(updateSparql2);
}
//#endregion

//#region content
// references
function retrieveReferences(fileMeta) {
	var research = [];
	var guidelines = [];
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
async function processTypos(fileMeta) {
	await findMatrixTypos(fileMeta);
	await promptTypoCorrections();
}

// load list of typos
async function loadTypos() {
	try {
		const contents = await readFile(typosPath, { encoding: 'utf8' });
		let typosObj = JSON.parse(contents);

		typoCorrectedList = typosObj;
	} catch (err) {
		console.error("loadTypos: " + err.message);
		console.error(err.trace);
	}
}

// add a typo to the list
function storeTypo(listname, inc, cor) {
	typoCorrectedList.push({ listname: listname, incorrect: inc, correct: cor });
}

// save the list of typos
async function saveTypos() {
	try {
		let res = Array.from(new Set(typoCorrectedList.map(JSON.stringify)))
			.map(JSON.parse); // eliminate duplicates
		await writeFile(typosPath, JSON.stringify(res), { encoding: 'utf8' });
	} catch (err) {
		console.error(err.message);
		console.error(err.trace);
	}
}

// look for potential typos in the yaml mappings
async function findMatrixTypos(fileMeta) {
	const mp = fileMeta.mappings;
	if (typeof mp !== "undefined") {
		mp.forEach(function (mapping) {
			//check for arrays Array.isArray(obj)
			//handle intersection objects

			// check for keyword "all"
			if (typeof mapping['functional-need'] === 'string' && compareStr(mapping['functional-need'], "all")) mapping['functional-need'] = getOneProp(functionalNeedList, 'label');
			if (typeof mapping['user-need'] === 'string' && compareStr(mapping['user-need'], "all")) mapping['user-need'] = getOneProp(userNeedList, 'label');
			if (typeof mapping['user-need-relevance'] === 'string' && compareStr(mapping['user-need-relevance'], "all")) mapping['user-need-relevance'] = getOneProp(userNeedContextList, 'label');

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
	}
	const accommTypeMappings = fileMeta["accomtype-mappings"];
	if (typeof accommTypeMappings !== "undefined") {
		accommTypeMappings.forEach(function (mapping) {
			// check for keyword "all"
			if (typeof mapping['functional-ability'] === 'string' && compareStr(mapping['functional-ability'], "all")) mapping['functional-ability'] = getOneProp(functionalAbilityList, 'label');

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
}

function checkPotentialTypo(listname, label) {
	// check against reference list
	let correctList = findObjectByProperties(knownMatrix, { "listname": listname }).list;
	if (typeof correctList !== 'undefined') {
		if (typeof findObjectByProperties(correctList, { "label": label }) !== 'undefined') {
			return label;
		}
	}
	// check against previously stored list
	let knownTypo = typoCorrectedList.find((obj) => { if (obj.listname == listname && obj.incorrect == label) return true; else return false; });
	if (typeof knownTypo !== 'undefined') {
		return knownTypo.correct;
	}
	// check against already found list
	let foundList = foundTypos.find((obj) => { if (obj.listname == listname && obj.incorrect == label) return true; else return false; });
	if (typeof foundList !== 'undefined') {
		return foundList.correct;
	}

	foundTypos.push({ "listname": listname, "incorrect": label });
	return null;
}

async function promptTypoCorrections() {
	let questions = [];
	let questionLists = [];

	foundTypos.forEach(function (typo, index) {
		let qid = "q" + index;
		questionLists[qid] = typo.listname;
		questions.push(makeInquirerQuestion(qid, typo.incorrect, typo.listname));
	});

	const answers = await inquirer.prompt(questions).then((answers) => answers);
	let skip = false;
	for (var i = 0; i < questions.length; i++) {
		let qid = "q" + i;
		if (answers[qid] == "[Skip file]") skip = true;
		else {
			let listname = questionLists[qid];
			storeTypo(listname, foundTypos[i].incorrect, answers[qid]);
		}
	}

	await saveTypos();
	foundTypos = [];
	if (skip) throw new Error("Skipped during typo check");
}

function getCorrectLabel(listname, label) {
	let typoCorrection = typoCorrectedList.find((obj) => { if (obj.listname == listname && obj.incorrect == label) return true; else return false; });
	if (typeof typoCorrection !== 'undefined') return typoCorrection.correct;
	else return label;
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
		choices: ["[Skip file]"].concat(getOneProp(arr, 'label')),
		waitUserInput: true,
		loop: false
	};
	return q;
}
//#endregion

await run();