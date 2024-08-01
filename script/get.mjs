import {selectQuery} from './dbquery.mjs';
import {findObjectByProperties, idFrag} from './util.mjs';

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
    { "path": "tags", "type": "Tag", "listFunc": findTagList, "idFunc": findTagId },
    { "path": "ability-accommodation-intersections", "type": "AbilityIntersectionMap", "listFunc": findAbilityAccommodationIntersectionList, "idFunc": findAbilityAccommodationIntersectionId},
    { "path": "accommodation-types", "type": "AccommodationType", "listFunc": findAccommodationTypeList, "idFunc": findAccommodationTypeId },
    { "path": "accessibility-characteristic-groups", "type": "AccessibilityCharacteristicGroup", "listFunc": findAccessibilityCharacteristicGroupList, "idFunc": findAccessibilityCharacteristicGroupId },
    { "path": "accessibility-characteristics", "type": "AccessibilityCharacteristic", "listFunc": findAccessibilityCharacteristicList, "idFunc": findAccessibilityCharacteristicId },
    { "path": "functional-abilities", "type": "FunctionalAbility", "listFunc": findFunctionalAbilityList, "idFunc": findFunctionalAbilityId },
    { "path": "functional-ability-groups", "type": "FunctionalAbilityGroup", "listFunc": findFunctionalAbilityGroupList, "idFunc": findFunctionalAbilityGroupId },
    { "path": "intersection-curve-maps", "type": "IntersectionAbilityCharacteristicMap", "listFunc": findIntersectionCurveMapList, "idFunc": findIntersectionCurveMapId },
    { "path": "simple-curve-maps", "type": "FunctionalAbilityCharacteristicMap", "listFunc": findSimpleCurveMapList, "idFunc": findSimpleCurveMapId }
]

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

async function findAbilityAccommodationIntersectionList(id = null) {
    let idFilter = "";
    if (id != null) idFilter = " values ?id { : " + id + " } . ";
    const sparql = "select ?id ?label ?abilityId ?abilityLabel ?accomId ?accomLabel where { " + idFilter + " ?id a a11y:AccessibilityAccommodationIntersectionMap . optional { ?id rdfs:label ?label } . ?id a11y:supports ?abilityId . ?abilityId a a11y:FunctionalAbility . ?abilityId rdfs:label ?abilityLabel .  ?id a11y:supports ?accomId . ?accomId a a11y:AccommodationType . ?abilityId rdfs:label ?accomLabel }";
    const val = await selectQuery(sparql);

    const stmts = await findStatementList(" ?id a11y:supports/a11y:supports :" + id + " . ");
    val[0].statements = stmts;

    return val;
}

async function findAbilityAccommodationIntersectionId(id) {
    const val = await findAbilityAccommodationIntersectionList(id);
    return val;
}

async function findAccessibilityCharacteristicGroupList() {
    const val = lookupTypeList("AccessibilityCharacteristicGroup");
    return val;
}

async function findAccessibilityCharacteristicGroupId(id) {
    const val = await lookupTypeId("AccessibilityCharacteristicGroup", id);

    const members = await lookupTypeList("AccessibilityCharacteristic", " ?id a11y:supports :" + id + " . ");
    val[0].members = members;

    return val;
}

async function findAccessibilityCharacteristicList() {
    const val = lookupTypeList("AccessibilityCharacteristic");
    return val;
}

async function findAccessibilityCharacteristicId(id) {
    const val = await lookupTypeId("AccessibilityCharacteristic", id);

    const stmts = await findStatementList(" ?id a11y:supports/a11y:supports :" + id + " . ");
    val[0].statements = stmts;

    return val;
}

async function findAccommodationTypeList() {
    const val = lookupTypeList("AccommodationType");
    return val;
}

async function findAccommodationTypeId(id) {
    const val = await lookupTypeId("AccommodationType", id);

    const stmts = await findStatementList(" ?id a11y:supports/a11y:supports :" + id + " . ");
    val[0].statements = stmts;

    return val;
}

async function findFunctionalAbilityGroupList() {
    const val = lookupTypeList("FunctionalAbilityGroup");
    return val;
}

async function findFunctionalAbilityGroupId(id) {
    const val = await lookupTypeId("FunctionalAbilityGroup", id);

    const members = await lookupTypeList("FunctionalAbility", " ?id a11y:supports :" + id + " . ");
    val[0].members = members;

    return val;
}

async function findFunctionalAbilityList() {
    const val = lookupTypeList("FunctionalAbility");
    return val;
}

async function findFunctionalAbilityId(id) {
    const val = await lookupTypeId("FunctionalAbility", id);

    const stmts = await findStatementList(" ?id a11y:supports/a11y:supports :" + id + " . ");
    val[0].statements = stmts;

    return val;
}

async function findIntersectionCurveMapList(id = null, supportsFilter = "") {
    let idFilter = "";
    if (id != null) idFilter = " values ?id { : " + id + " } . ";
    const sparql = "select ?id ?intersectMapId ?charId ?charLabel where { " + idFilter + supportsFilter +  " ?id a a11y:IntersectionCurveMap . ?id a11y:supports ?intersectMapId . ?intersectMapId a a11y:AbilityAccommodationIntersection . ?id a11y:supports ?charId . ?charId a a11y:AccessibilityCharacteristic . ?charId rdfs:label ?charLabel }";
    const val = await selectQuery(sparql);
    return val;
}

async function findIntersectionCurveMapId(id) {
    const val = await findIntersectionCurveMapList(id);
    return val;
}

async function findSimpleCurveMapList(id = null, supportsFilter = "") {
    let idFilter = "";
    if (id != null) idFilter = " values ?id { : " + id + " } . ";
    const sparql = "select ?id ?stmtId ?abilityId ?abilityLabel ?accomId ?accomLabel ?charId ?charLabel ?applicable where { " + idFilter + supportsFilter + " ?id a a11y:SimpleCurveMap . ?stmtId a a11y:AccessibilityStatement . ?stmtId a11y:supports ?id . ?id a11y:supports ?abilityId . ?abilityId a a11y:FunctionalAbility . ?abilityId rdfs:label ?abilityLabel . ?id a11y:supports ?accomId . ?accomId a a11y:AccommodationType . ?accomId rdfs:label ?accomLabel . ?id a11y:supports ?charId . ?charId a a11y:AccessibilityCharacteristic . ?charId rdfs:label ?charLabel . optional { ?id a11y:applicable ?applicable } }";
    const val = await selectQuery(sparql);
    return val;
}

async function findSimpleCurveMapId() {
    const val = await findSimpleCurveMapList(id);
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
    console.log(sparql);

    const refs = await findReferenceList(" :" + id + " a11y:references ?id . ");
    console.log(refs);
    val[0].references = refs;

    const tags = await findTagList(":" + id + " a11y:tags ?id . ");
    val[0].tags = tags;

    const mappings = await findMappingList("Mapping", ":" + id + " a11y:supports ?id . ");
    val[0].mappings = mappings;

    const accommtypeMappings = await findSimpleCurveMapList(null, " :" + id + " a11y:supports ?id . ");
    val[0]["accommtype-mappings"] = accommtypeMappings;

    return val;
}

async function findCategoryId(id) {
    const val = lookupTypeList("Category");
    return val;
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

