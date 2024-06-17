import {selectQuery} from './dbquery.mjs';
import {findObjectByProperties, idFrag} from './util.mjs';

export async function getSection(req) {
    const route = findObjectByProperties(sectionMappings, {"path": req.params.section});
    const val = await route.listFunc.call(this);
    return val;
}

export async function getId(req) {
    const route = findObjectByProperties(sectionMappings, {"path": req.params.section});
    const val = await route.idFunc.call(this, req.params.id);
    return val;
}

async function lookupTypeList(type, supportsFilter = "") { 
    const sparql = "select ?id ?label ?type where {" + supportsFilter + narrowType(type) + " optional {?id rdfs:label ?label} } order by ?label";
    const val = await selectQuery(sparql);
    return val;
}
async function lookupTypeId(type, id) { 
    const sparql = "select ?id ?label ?type where { values ?id {:" + id + "} . " + narrowType(type) + " optional {?id rdfs:label ?label} } order by ?label";
    const val = await selectQuery(sparql);
    return val;
}

async function findStatementList(supportsFilter = "") {
    const sparql = "select distinct ?id ?label ?type ?stmt ?note where {" + supportsFilter + narrowType("AccessibilityStatement") + " ?id a11y:stmtGuidance ?stmt . optional {?id rdfs:label ?label} . optional { ?id a11y:note ?note} } order by ?label" 
    const val = await selectQuery(sparql);
    return val;
}
async function findStatementId(id) {
    const sparql = "select distinct ?id ?label ?type ?stmt ?note ?contentIRI where { values ?id {:" + id + "} . " + narrowType("AccessibilityStatement") + " ?id a11y:stmtGuidance ?stmt . optional {?id rdfs:label ?label} . optional { ?id a11y:contentIRI ?contentIRI} . optional { ?id a11y:note ?note} } order by ?label" 
    const val = await selectQuery(sparql);

    const refs = await findReferenceList(" :" + id + " a11y:references ?id . ");
    val[0].references = refs;

    const tags = await findTagList(":" + id + " a11y:tags ?id . ");
    val[0].tags = tags;

    const mappings = await findMappingList("Mapping", ":" + id + " a11y:supports ?id . ");
    val[0].mappings = mappings;

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
    val[0].functionalNeeds = fns;
    
    return val;
}
async function findFunctionalNeedList(supportsFilter = "") { 
    const sparql = "select ?id ?label ?type ?categoryId where {" + supportsFilter + narrowType("FunctionalNeed") + " ?id a11y:supports ?categoryId . ?categoryId a a11y:FunctionalNeedCategory . optional {?id rdfs:label ?label} } order by ?label";
    const val = await selectQuery(sparql); 
    return val;
}
async function findFunctionalNeedId(id) { 
    const sparql = "select ?id ?label ?type ?categoryId where { values ?id {:" + id + "} . " + narrowType("FunctionalNeed") + " ?id a11y:supports ?categoryId . ?categoryId a a11y:FunctionalNeedCategory . optional {?id rdfs:label ?label} } order by ?label";
    const val = await selectQuery(sparql);

    const stmts = await findStatementList(" ?id a11y:supports/a11y:supports :" + id + " . ");
    val[0].statements = stmts;

    return val;
}
async function findIntersectionNeedList(supportsFilter = "") {
    const sparql = 'select ?id ?label ?fn1 ?fn2 where { ?id a a11y:IntersectionNeed ; a11y:supports ?fn1 ; a11y:supports ?fn2 . filter (!sameterm(?fn1, ?fn2)) . optional { ?id rdfs:label ?label } }';
    const val = await selectQuery(sparql);
    return val;
}
async function findIntersectionNeedId(id) {
    const sparql = 'select ?id ?label where { values ?id { :' + id + ' } . optional {?id rdfs:label ?label} } order by ?label';
    const val = await selectQuery(sparql);

    const fns = await findFunctionalNeedList(" :" + id + " a11y:supports ?id . ");
    val[0].functionalNeeds = fns;

    const stmts = await findStatementList(" ?id a11y:supports/a11y:supports :" + id + " . ");
    val[0].statements = stmts;

    return val;
}
/*
async function findUserNeedCategories(id) {
    return lookupTypeList("UserNeedCategory") 
}
*/
async function findMappingId(id) {
    const sparql = "select ?id ?applicable ?fnId ?unId ?unrId ?type where { values ?id {:" + id + "} . " + narrowType("Mapping") + " { ?fnId a a11y:FunctionalNeed . ?id  a11y:supports ?fnId } union { ?fnId a a11y:IntersectionNeed . ?id a11y:supports ?fnId } . ?id a11y:supports ?unId ; a11y:supports ?unrId . ?unId a a11y:UserNeed . ?unrId a a11y:UserNeedRelevance . optional { ?id a11y:applicable ?applicable } }";
    const val = await selectQuery(sparql);

    const stmts = await findStatementList(" ?id a11y:supports :" + id + " . ");
    val[0].statements = stmts;

    const fns = await lookupTypeId("FunctionalNeed", idFrag(val[0].fnId));
    const ins = await lookupTypeId("IntersectionNeed", idFrag(val[0].fnId));
    const uns = await lookupTypeId("UserNeed", idFrag(val[0].unId));
    const uncs = await lookupTypeId("UserNeedRelevance", idFrag(val[0].unrId));

    if (fns.length > 0) val[0].functionalNeed = fns[0];
    if (ins.length > 0) val[0].intersectionNeed = ins[0];
    val[0].userNeed = uns[0];
    val[0].userNeedRelevance = uncs[0];

    return val;
}
async function findMappingList(type = "Mapping", supportsFilter = "") { 
    const sparql = "select ?id ?applicable ?stmtId ?fnId ?unId ?unrId ?type where { " + supportsFilter + narrowType("Mapping") + " optional { ?stmtId a11y:supports ?id } . ?id  a11y:supports ?fnId ; a11y:supports ?unId ; a11y:supports ?unrId . { ?fnId a a11y:FunctionalNeed } union { ?fnId a a11y:IntersectionNeed } . ?unId a a11y:UserNeed . ?unrId a a11y:UserNeedRelevance . optional { ?id a11y:applicable ?applicable } }";
    const val = await selectQuery(sparql);
    return val;
}
async function findIntersectionMappingList(supportsFilter = "") { 
    return findMappingList("IntersectionMapping", supportsFilter)
}
async function findIntersectionMappingId(id) { 
    return findMappingId("IntersectionMapping")
}
async function findMatrixMappingList(supportsFilter = "") { 
    return findMappingList("MatrixMapping", supportsFilter)
}
async function findMatrixMappingId(id) { 
    return findMappingId(id)
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
    return lookupTypeList("UserNeedRelevance")
}
async function findUserNeedRelevanceId(id) { 
    const val = await lookupTypeList("UserNeedRelevance");

    const stmts = await findStatementList(" ?id a11y:supports/a11y:supports :" + id + " . ");
    val[0].statements = stmts;

    return val;
}

async function findReferenceId(id) {
    const sparql = "select ?id ?label ?type ?refType ?refIRI ?refNote ?stmtId ?stmtLabel where { values ?id {:" + id + "} . " + narrowType("Reference") + " ?id a11y:refType ?rt . ?rt rdfs:label ?refType . ?id a11y:refIRI ?refIRI . ?stmtId a11y:references ?id . ?stmtId rdfs:label ?stmtLabel . optional {?id a11y:refNote ?refNote} . optional {?id rdfs:label ?label} } order by ?refIRI";
    const val = await selectQuery(sparql);
    return val;
}
async function findReferenceList(supportsFilter = "") {
    const sparql = "select ?id ?label ?type ?refType ?refIRI ?refNote ?stmtId ?stmtLabel where {" + supportsFilter + narrowType("Reference") + " ?id a11y:refType ?rt . ?rt rdfs:label ?refType . ?id a11y:refIRI ?refIRI . ?stmtId a11y:references ?id . ?stmtId rdfs:label ?stmtLabel . optional {?id a11y:refNote ?refNote} . optional {?id rdfs:label ?label} } order by ?refIRI";
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
    const sparql = "select ?id ?label ?type where {" + supportsFilter + narrowType("Tag") + " optional {?id rdfs:label ?label} } order by ?label";
    const val = await selectQuery(sparql);
    return val;
}
async function findTagId(id) { 
    const val = await lookupTypeId("Tag", id);

    const stmts = await findStatementList(" ?id a11y:tags :" + id + " . ");
    val[0].statements = stmts;

    return val;
}

function narrowType(type) {
    return " bind((a11y:" + type + ") as ?mtype) . ?id a ?mtype . ?type ^a ?id filter not exists { ?subtype ^a ?id ; rdfs:subClassOf ?type . filter ( ?subtype != ?type ) } filter( strstarts(str(?type),str(a11y:)) ) .";
}

const sectionMappings = [
    { "path": "statements", "type": "AccessibilityStatement", "listFunc": findStatementList, "idFunc": findStatementId },
    //{ "path": "categories", "type": "Category", "listFunc": find@@List, "idFunc": find@@Id },
    { "path": "functional-need-categories", "type": "FunctionalNeedCategory", "listFunc": findFunctionalNeedCategoryList, "idFunc": findFunctionalNeedCategoryId },
    //{ "path": "user-need-categories", "type": "UserNeedCategory", "listFunc": findUserNeedCategoryList, "idFunc": findUserNeedCategoryId },
    { "path": "mappings", "type": "Mapping", "listFunc": findMappingList, "idFunc": findMappingId },
    { "path": "intersection-mappings", "type": "IntersectionMapping", "listFunc": findIntersectionMappingList, "idFunc": findIntersectionMappingId },
    { "path": "matrix-mappings", "type": "MatrixMapping", "listFunc": findMatrixMappingList, "idFunc": findMatrixMappingId },
    //{ "path": "matrix-dimensions", "type": "MatrixDimension", "listFunc": find@@List, "idFunc": find@@Id },
    { "path": "functional-needs", "type": "FunctionalNeed", "listFunc": findFunctionalNeedList, "idFunc": findFunctionalNeedId },
    { "path": "intersection-needs", "type": "IntersectionNeed", "listFunc": findIntersectionNeedList, "idFunc": findIntersectionNeedId },
    { "path": "user-needs", "type": "UserNeed", "listFunc": findUserNeedList, "idFunc": findUserNeedId },
    { "path": "user-need-contexts", "type": "UserNeedRelevance", "listFunc": findUserNeedRelevanceList, "idFunc": findUserNeedRelevanceId },
    { "path": "references", "type": "Reference", "listFunc": findReferenceList, "idFunc": findReferenceId },
    //{ "path": "term-sets", "type": "TermSet", "listFunc": find@@List, "idFunc": find@@Id },
    //{ "path": "reference-types", "type": "ReferenceType", "listFunc": find@@List, "idFunc": find@@Id },
    { "path": "tags", "type": "Tag", "listFunc": findTagList, "idFunc": findTagId }
]

