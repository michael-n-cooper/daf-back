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

async function lookupTypeList(type, supportsFilter = "") { 
    if (type == "AccessibilityStatement") return findStatementList(supportsId);

    const sparql = "select ?id ?label ?type where {" + supportsFilter + " bind((a11y:" + type + ") as ?type) . ?id a a11y:" + type + " . optional {?id rdfs:label ?label} } order by ?label";
    const val = await selectQuery(sparql);
    return val;
}
async function lookupTypeId(type, id) { 
    if (type == "AccessibilityStatement") return findStatementId(id);

    const sparql = "select ?id ?label ?type where { values ?id {:" + id + "} . bind((a11y:" + type + ") as ?type) . ?id a a11y:" + type + " . optional {?id rdfs:label ?label} } order by ?label";
    const val = await selectQuery(sparql);
    return val;
}

async function findStatementList(supportsFilter = "") {
    const sparql = "select distinct ?id ?label ?type ?stmt ?note where {" + supportsFilter + " bind((a11y:AccessibilityStatement) as ?type) . ?id a ?type ; a11y:stmtGuidance ?stmt . optional {?id rdfs:label ?label} . optional { ?id a11y:note ?note} } order by ?label" 
    const val = await selectQuery(sparql);
    return val;
}
async function findStatementId(id) {
    const sparql = "select distinct ?id ?label ?type ?stmt ?note where { values ?id {:" + id + "} . bind((a11y:AccessibilityStatement) as ?type) . ?id a ?type ; a11y:stmtGuidance ?stmt . optional {?id rdfs:label ?label} . optional { ?id a11y:note ?note} } order by ?label" 
    const val = await selectQuery(sparql);

    const refs = await findReferenceList(" :" + id + " a11y:references ?id . ");
    val[0].references = refs;

    const tags = await findTagList(":" + id + " a11y:tags ?id . ");
    val[0].tags = tags;

    return val;
}

async function findCategoryId(id) {
    return lookupTypeList("Category") 
}

async function findFunctionalNeedCategoryList(supportsFilter = "") { 
    const val = await lookupTypeList("FunctionalNeedCategory", supportsFilter);
    return val;
}
async function findFunctionalNeedCategoryId(id) { 
    const val = await lookupTypeId("FunctionalNeedCategory", id);

    const fns = await findFunctionalNeedList(" ?id a11y:supports :" + id + " . ");
    val[0].functional-needs = fns;
    
    return val;
}
async function findFunctionalNeedList(supportsFilter = "") { 
    const val = await lookupTypeList("FunctionalNeed", supportsFilter); 
    return val;
}
async function findFunctionalNeedId(id) { 
    const val = await lookupTypeId("FunctionalNeed", id);

    const stmts = await findStatementList(" ?id a11y:supports/a11y:supports :" + id + " . ");
    val[0].statements = stmts;

    return val;
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

async function findUserNeedList(supportsFilter = "") { 
    const val = await lookupTypeList("UserNeed", supportsFilter); 
    return val;
}
async function findUserNeedId(id) { 
    const val = await lookupTypeList("UserNeed");

    const stmts = await findStatementList(" ?id a11y:supports/a11y:supports :" + id + " . ");
    val[0].statements = stmts;

    return val;
}

async function findUserNeedRelevanceList(id) { 
    return lookupTypeList("UserNeedContext")
}
async function findUserNeedRelevanceId(id) { 
    const val = await lookupTypeList("UserNeedRelevance");

    const stmts = await findStatementList(" ?id a11y:supports/a11y:supports :" + id + " . ");
    val[0].statements = stmts;

    return val;
}

async function findReferenceId(id) {
    const sparql = "select ?id ?label ?type ?refType ?refIRI ?refNote where { values ?id {:" + id + "} . bind((a11y:Reference) as ?type) . ?id a ?type ; a11y:refType ?rt . ?rt rdfs:label ?refType . ?id a11y:refIRI ?refIRI . optional {?id a11y:refNote ?refNote} . optional {?id rdfs:label ?label} } order by ?refIRI";
    const val = await selectQuery(sparql);
    return val;
}
async function findReferenceList(supportsFilter = "") {
    const sparql = "select ?id ?label ?type ?refType ?refIRI ?refNote where {" + supportsFilter + " bind((a11y:Reference) as ?type) . ?id a ?type ; a11y:refType ?rt . ?rt rdfs:label ?refType . ?id a11y:refIRI ?refIRI . optional {?id a11y:refNote ?refNote} . optional {?id rdfs:label ?label} } order by ?refIRI";
    const val = await selectQuery(sparql);
    return val;
}
async function findTermList(id) { 
    return lookupTypeList("Term") 
}
async function findReferenceTypeList(id) {
    return lookupTypeList("ReferenceType") 
}
async function findTagList(supportsFilter = "") { 
    const sparql = "select ?id ?label ?type where {" + supportsFilter + " bind((a11y:Tag) as ?type) . ?id a ?type . optional {?id rdfs:label ?label} } order by ?label";
    const val = await selectQuery(sparql);
    return val;
}
async function findTagId(id) { 
    const val = await lookupTypeId("Tag", id);

    const stmts = await findStatementList(" ?id a11y:supports/a11y:supports :" + id + " . ");
    val[0].statements = stmts;

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

