import {selectQuery} from './dbquery.mjs';

export async function getSection(req) {
    const val = await selectQuery(sectionMappings[req.params.section].list.call());
    return cleanResults(val);
}

export async function getId(req) {
    console.log(sectionMappings[req.params.section].list.call(this, req.params.id));
    const val = await selectQuery(sectionMappings[req.params.section].list.call(this, req.params.id));
    return cleanResults(val);
}

export async function getSupports(req) {

}

function lookupType(type) { return "select ?id ?label where { ?id a a11y:" + type + " ; rdfs:label ?label } order by ?label" }
function lookupSupports(supportsType) {}

function findStatements(id) { return "select distinct ?id ?label ?stmt ?note where { " + (typeof id !== "undefined" ? "values ?id {:" + id + "}": "") + " ?id a a11y:AccessibilityStatement ; rdfs:label ?label ; a11y:stmtGuidance ?stmt . optional { ?id a11y:note ?note} } order by ?label" }
function findCategories() { return lookupType("Category") }
function findFunctionalNeedCategories() { return lookupType("FunctionalNeedCategory") }
function findUserNeedCategories() { return lookupType("UserNeedCategory") }
function findMappings() { return lookupType("Mapping") }
function findIntersectionMappings() { return lookupType("IntersectionMapping") }
function findMatrixMappings() { return lookupType("MatrixMapping") }
function findMatrixDimensions() { return lookupType("MatrixDimension") }
function findFunctionalNeeds() { return lookupType("FunctionalNeed") }
function findFunctionalNeedSupports() {}
function findUserNeeds() { return lookupType("UserNeed") }
function findUserNeedSupports() {}
function findUserNeedRelevances() { return lookupType("UserNeedContext") }
function findUserNeedRelevanceSupports() {}
function findReferences() { return lookupType("Reference") }
function findReferenceSupports() {}
function findTerms() { return lookupType("Term") }
function findTermSupports() {}
function findReferenceTypes() { return lookupType("ReferenceType") }
function findReferenceTypeSupports() {}
function findTags() { return lookupType("Tag") }
function findTagSupports() {}

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
        "list": findStatements
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
        "list": findReferences,
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

