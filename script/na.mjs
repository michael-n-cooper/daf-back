import * as dbquery from './dbquery.js';
import {findObjectByProperties, filterObjectByProperties, idFrag, compareStr, isValidUrl, getOneProp, getFileData, escSparql} from './util-base.js';

const functionalNeedList = ["f65b7ac6-6d0d-4540-8891-73769f96b05f", "3a3bd86d-f18d-499a-a4d1-923c7e6eda4c", "95746028-e638-446c-9f6e-890d20faf446", "79e8cb4e-1c3b-44dd-81d7-a21bd9945758"];// await lookupIds("FunctionalNeed");
const existingSet = await getExisting(); 
const toLoop = new Array();
toLoop.push(["7e3efc35-5658-4fbd-acb3-0706f1fe861e", ["b73ddfdd-30f2-40b7-b8ed-9255899daa7b", "499a693e-9b66-428d-80ff-74bde49eea81", "d8ae8224-8347-4987-8d0b-d8711c5beabd", "7218d01b-fda9-44a6-bd1d-13931cfc0840"]]);
toLoop.push(["420fdce5-b640-4210-a93d-571e9a8b33f4", ["20d9f38e-d72e-4fca-abf8-dc7c61b6c57b", "6fda1b60-0fec-4b34-a1dc-8328d90750d5", "17436ecc-2b51-417d-a69a-17f14d13b776", "383dbc49-8012-4299-9443-06812baeae24", "2c75ba30-a758-4cc2-98fb-090fa0e061d3"]]);
toLoop.push(["7c535f8d-a8d9-44c6-8db8-8640b6fb4157", ["20d9f38e-d72e-4fca-abf8-dc7c61b6c57b", "6fda1b60-0fec-4b34-a1dc-8328d90750d5", "17436ecc-2b51-417d-a69a-17f14d13b776", "383dbc49-8012-4299-9443-06812baeae24", "2c75ba30-a758-4cc2-98fb-090fa0e061d3"]]);

var sparql = "insert data {\n";
//toLoop, first id is User Need, 2nd is Relevance, loop across all functional neeeds
toLoop.forEach(function(un) {
	let unId = un[0];
	un[1].forEach(function(unr) {
		let unrId = unr;
		functionalNeedList.forEach(function(fn) {
			let fnId = fn;
			let id = null;
			let existing = findObjectByProperties(existingSet, {"fnId": fnId, "unId": unId, "unrId": unrId});
			if (typeof existing === 'undefined') {
				id = dbquery.uuid();
				sparql += ":" + id + " a a11y:MatrixMapping .\n";
				sparql += ":" + id + " a11y:supports :" + fnId + " .\n";
				sparql += ":" + id + " a11y:supports :" + unId + " .\n";
				sparql += ":" + id + " a11y:supports :" + unrId + " .\n";
			} else {
				id = existing.id;
			}
			sparql += ":" + id + " a11y:applicable false .\n"
		});
	});
});
sparql += "}";
console.log(sparql);


async function lookupIds(type) {
	var returnval = new Array();
	const sparql = 'select ?id where { ?id a a11y:' + type + ' } ';
	const results = await dbquery.selectQuery(sparql);
	if (results.results.bindings.length > 0) {
		results.results.bindings.forEach(function(result) {
			returnval.push(idFrag(result.id.value));
		});
	}
	return returnval;
}

async function getExisting() {
	var returnval = new Array();
	const existingSparql = 'select ?id ?fnId ?unId ?unrId where { ?id a a11y:Mapping ; a11y:supports ?fnId ; a11y:supports ?unId ; a11y:supports ?unrId . ?fnId a a11y:FunctionalNeed . ?unId a a11y:UserNeed . ?unrId a a11y:UserNeedRelevance }';
	const existingResult = await dbquery.selectQuery(existingSparql);
	if (typeof existingResult.results.bindings !== 'undefined') {
		existingResult.results.bindings.forEach(function(result) {
			returnval.push({"id": idFrag(result.id.value), "fnId": idFrag(result.fnId.value), "unId": idFrag(result.unId.value), "unrId": idFrag(result.unrId.value)});
		});
	}
	return returnval;
}