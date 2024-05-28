import {selectQuery} from './dbquery.mjs';

export async function getSection(req) {
    const val = await lookupTypeList(sectionMappings[req.params.section].type);
    return val;
}

export async function getId(req) {
    const val = await lookupTypeId(sectionMappings[req.params.section].type, req.params.id);
    return val;
}

export async function getSupports(req) {

}

async function lookupTypeId(type, id) { 
    if (type == "AccessibilityStatement") return findStatementId(id);

    const sparql = "select ?id ?label ?type where { values ?id {:" + id + "} . bind((a11y:" + type + ") as ?type) . ?id a a11y:" + type + " . optional {?id rdfs:label ?label} } order by ?label";
    const val = await selectQuery(sparql);
    return cleanResults(val);
}
async function lookupTypeList(type, supportsId) { 
    if (type == "AccessibilityStatement") return findStatementList(supportsId);

    const sparql = "select ?id ?label ?type where {" + (typeof supportsId !== "undefined" ? " ?id a11y:supports :" + supportsId + " . " : "") + " bind((a11y:" + type + ") as ?type) . ?id a a11y:" + type + " . optional {?id rdfs:label ?label} } order by ?label";
    const val = await selectQuery(sparql);
    return cleanResults(val);
}

async function findStatementId(id) {
    const sparql = "select distinct ?id ?label ?type ?stmt ?note where { values ?id {:" + id + "} . bind((a11y:AccessibilityStatement) as ?type) . ?id a ?type ; a11y:stmtGuidance ?stmt . optional {?id rdfs:label ?label} . optional { ?id a11y:note ?note} } order by ?label" 
    const val = cleanResults(await selectQuery(sparql));
    const refs = await findReferenceList(id);
    console.log(val);

    val[0].references = refs;
    return val;
}
async function findStatementList(supportsId) {
    const sparql = "select distinct ?id ?label ?type ?stmt ?note where {" + (typeof supportsId !== "undefined" ? " ?id a11y:supports/a11y:supports :" + supportsId + " . " : "") + " bind((a11y:AccessibilityStatement) as ?type) . ?id a ?type ; a11y:stmtGuidance ?stmt . optional {?id rdfs:label ?label} . optional { ?id a11y:note ?note} } order by ?label" 
    const val = await selectQuery(sparql);
    return cleanResults(val);
}
async function findCategories(id) {
    return lookupTypeList("Category") 
}
async function findFunctionalNeedCategories(id) { 
    return lookupTypeList("FunctionalNeedCategory", id) 
}
async function findUserNeedCategories(id) {
    return lookupTypeList("UserNeedCategory") 
}
async function findMappings(id) { 
    return lookupTypeList("Mapping")
}
async function findIntersectionMappings(id) { 
    return lookupTypeList("IntersectionMapping")
}
async function findMatrixMappings(id) { 
    return lookupTypeList("MatrixMapping")
}
async function findMatrixDimensions(id) { 
    return lookupTypeList("MatrixDimension")
}
async function findFunctionalNeeds(id) { 
    return lookupTypeList("FunctionalNeed")
}
async function findFunctionalNeedSupports() {
}
async function findUserNeeds(id) { 
    return lookupTypeList("UserNeed")
}
async function findUserNeedSupports() {
}
async function findUserNeedRelevances(id) { 
    return lookupTypeList("UserNeedContext")
}
async function findUserNeedRelevanceSupports() {
}
async function findReferenceId(id) {
    const sparql = "select ?id ?label ?type ?refType ?refIRI ?refNote where { values ?id {:" + id + "} . bind((a11y:Reference) as ?type) . ?id a ?type ; a11y:refType ?rt . ?rt rdfs:label ?refType . ?id a11y:refIRI ?refIRI . optional {?id a11y:refNote ?refNote} . optional {?id rdfs:label ?label} } order by ?refIRI";
    const val = await selectQuery(sparql);
    return cleanResults(val);
}
async function findReferenceList(supportsId) {
    const sparql = "select ?id ?label ?type ?refType ?refIRI ?refNote where {" + (typeof supportsId !== "undefined" ? " :" + supportsId + " a11y:references ?id . " : "") + " bind((a11y:Reference) as ?type) . ?id a ?type ; a11y:refType ?rt . ?rt rdfs:label ?refType . ?id a11y:refIRI ?refIRI . optional {?id a11y:refNote ?refNote} . optional {?id rdfs:label ?label} } order by ?refIRI";
    const val = await selectQuery(sparql);
    return cleanResults(val);
}
async function findReferenceSupports() {
}
async function findTerms(id) { 
    return lookupTypeList("Term") 
}
async function findTermSupports() {
}
async function findReferenceTypes(id) {
    return lookupTypeList("ReferenceType") 
}
async function findReferenceTypeSupports() {
}
async function findTags(id) { 
    return lookupTypeList("Tag") 
}
async function findTagSupports() {
}

function cleanResults(result) {
    let arr = new Array();
    result.results.bindings.forEach(function(binding) {
        let obj = {};
        result.head.vars.forEach(function(col) {
            obj[col] = typeof binding[col] !== "undefined" ? binding[col].value : null;
        });
        arr.push(obj);
    });
    return arr;
}

const sectionMappings = {
    "statements": {
        "type": "AccessibilityStatement",
        "list": findStatementList
    },
    "categories": {
        "type": "Category",
        "list": findCategories
    },
    "functional-need-categories": {
        "type": "FunctionalNeedCategory",
        "list": findFunctionalNeedCategories
    },
    "user-need-categories": {
        "type": "UserNeedCategory",
        "list": findUserNeedCategories
    },
    "mappings": {
        "type": "Mapping",
        "list": findMappings
    },
    "intersection-mappings": {
        "type": "IntersectionMapping",
        "list": findIntersectionMappings
    },
    "matrix-mappings": {
        "type": "MatrixMapping",
        "list": findMatrixMappings
    },
    "matrix-dimensions": {
        "type": "MatrixDimension",
        "list": findMatrixDimensions
    },
    "functional-needs": {
        "type": "FunctionalNeed",
        "list": findFunctionalNeeds,
        "supports": findFunctionalNeedSupports
    },
    "user-needs": {
        "type": "UserNeed",
        "list": findUserNeeds,
        "supports": findUserNeedSupports
    },
    "user-need-contexts": {
        "type": "UserNeedRelevance",
        "list": findUserNeedRelevances,
        "supports": findUserNeedRelevanceSupports
    },
    "references": {
        "type": "Reference",
        "list": findReferenceList,
        "supports": findReferenceSupports
    },
    "term-sets": {
        "type": "TermSet",
        "list": findTerms,
        "supports": findTermSupports
    },
    "reference-types": {
        "type": "ReferenceType",
        "list": findReferenceTypes,
        "supports": findReferenceTypeSupports
    },
    "tags": {
        "type": "Tag",
        "list": findTags,
        "supports": findTagSupports
    }
}

