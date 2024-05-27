import {selectQuery} from './dbquery.mjs';

export async function getSection(req) {
    console.log("hre");
    const val = await findStatements();//sectionMappings[req.params.section].list;
    console.log("there");
    return val;
}

export async function getId(req) {

}

export async function getSupports(req) {

}

async function findStatements() {
    const sparql = "select distinct ?id ?label ?stmt where { ?id a a11y:AccessibilityStatement . ?id rdfs:label ?label ; a11y:stmtGuidance ?stmt } order by ?label";
    const result = await selectQuery(sparql);
    return result;
}

async function findCategories() {}
async function findFunctionalNeedCategories() {}
async function findUserNeedCategories() {}
async function findMappings() {}
async function findIntersectionMappings() {}
async function findMatrixMappings() {}
async function findMatrixDimensions() {}
async function findFunctionalNeeds() {}
async function findFunctionalNeedSupports() {}
async function findUserNeeds() {}
async function findUserNeedSupports() {}
async function findUserNeedRelevances() {}
async function findUserNeedRelevanceSupports() {}
async function findReferences() {}
async function findReferenceSupports() {}
async function findTerms() {}
async function findTermSupports() {}
async function findReferenceTypes() {}
async function findReferenceTypeSupports() {}
async function findTags() {}
async function findTagSupports() {}

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

