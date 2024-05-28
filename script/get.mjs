import {selectQuery} from './dbquery.mjs';

export async function getSection(req) {
    const val = await lookupTypeList(sectionMappings[req.params.section]);
    return val;
}

export async function getId(req) {
    const val = await lookupTypeId(sectionMappings[req.params.section], req.params.id);
    return val;
}

export async function getSupports(req) {

}

async function lookupTypeId(type, id) { 
    if (type == "AccessibilityStatement") return findStatementId(id);

    const sparql = "select ?id ?label ?type where { values ?id {:" + id + "} . bind((a11y:" + type + ") as ?type) . ?id a a11y:" + type + " . optional {?id rdfs:label ?label} } order by ?label";
    const val = await selectQuery(sparql);
    return val;
}
async function lookupTypeList(type, supportsId) { 
    if (type == "AccessibilityStatement") return findStatementList(supportsId);

    const sparql = "select ?id ?label ?type where {" + (typeof supportsId !== "undefined" ? " ?id a11y:supports :" + supportsId + " . " : "") + " bind((a11y:" + type + ") as ?type) . ?id a a11y:" + type + " . optional {?id rdfs:label ?label} } order by ?label";
    const val = await selectQuery(sparql);
    return val;
}

async function findStatementId(id) {
    const sparql = "select distinct ?id ?label ?type ?stmt ?note where { values ?id {:" + id + "} . bind((a11y:AccessibilityStatement) as ?type) . ?id a ?type ; a11y:stmtGuidance ?stmt . optional {?id rdfs:label ?label} . optional { ?id a11y:note ?note} } order by ?label" 
    const val = await selectQuery(sparql);

    const refs = await findReferenceList(id);
    val[0].references = refs;

    const tags = await findTagList(id);
    val[0].tags = tags;

    return val;
}
async function findStatementList(supportsId) {
    const sparql = "select distinct ?id ?label ?type ?stmt ?note where {" + (typeof supportsId !== "undefined" ? " ?id a11y:supports/a11y:supports :" + supportsId + " . " : "") + " bind((a11y:AccessibilityStatement) as ?type) . ?id a ?type ; a11y:stmtGuidance ?stmt . optional {?id rdfs:label ?label} . optional { ?id a11y:note ?note} } order by ?label" 
    const val = await selectQuery(sparql);
    return val;
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
async function findUserNeeds(id) { 
    return lookupTypeList("UserNeed")
}
async function findUserNeedRelevances(id) { 
    return lookupTypeList("UserNeedContext")
}
async function findReferenceId(id) {
    const sparql = "select ?id ?label ?type ?refType ?refIRI ?refNote where { values ?id {:" + id + "} . bind((a11y:Reference) as ?type) . ?id a ?type ; a11y:refType ?rt . ?rt rdfs:label ?refType . ?id a11y:refIRI ?refIRI . optional {?id a11y:refNote ?refNote} . optional {?id rdfs:label ?label} } order by ?refIRI";
    const val = await selectQuery(sparql);
    return val;
}
async function findReferenceList(supportsId) {
    const sparql = "select ?id ?label ?type ?refType ?refIRI ?refNote where {" + (typeof supportsId !== "undefined" ? " :" + supportsId + " a11y:references ?id . " : "") + " bind((a11y:Reference) as ?type) . ?id a ?type ; a11y:refType ?rt . ?rt rdfs:label ?refType . ?id a11y:refIRI ?refIRI . optional {?id a11y:refNote ?refNote} . optional {?id rdfs:label ?label} } order by ?refIRI";
    const val = await selectQuery(sparql);
    return val;
}
async function findTerms(id) { 
    return lookupTypeList("Term") 
}
async function findReferenceTypes(id) {
    return lookupTypeList("ReferenceType") 
}
async function findTagId(id) { 
    return lookupTypeId("Tag", id) 
}
async function findTagList(supportsId) { 
    const sparql = "select ?id ?label ?type where {" + (typeof supportsId !== "undefined" ? " :" + supportsId + " a11y:tags ?id . " : "") + " bind((a11y:Tag) as ?type) . ?id a ?type . optional {?id rdfs:label ?label} } order by ?label";
    const val = await selectQuery(sparql);
    return val;
}

const sectionMappings = {
    "statements": "AccessibilityStatement",
    "categories": "Category",
    "functional-need-categories": "FunctionalNeedCategory",
    "user-need-categories": "UserNeedCategory",
    "mappings": "Mapping",
    "intersection-mappings": "IntersectionMapping",
    "matrix-mappings": "MatrixMapping",
    "matrix-dimensions": "MatrixDimension",
    "functional-needs": "FunctionalNeed",
    "user-needs": "UserNeed",
    "user-need-contexts": "UserNeedRelevance",
    "references": "Reference",
    "term-sets": "TermSet",
    "reference-types": "ReferenceType",
    "tags": "Tag"
}

