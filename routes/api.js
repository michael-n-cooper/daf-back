var express = require('express');
var router = express.Router();

const sectionRouter = function (req, res, next) {
    res.json(req.params.section);
    next();
}

const sectionIdRouter = function (req, res, next) {
    res.json({"section": req.params.section, "id": req.params.id});
    next();
}

const sectionIdSupportsRouter = function (req, res, next) {
    res.json({"section": req.params.section, "id": req.params.id, "supports": req.params.supports});
    next();
}

router.get('/:section', sectionRouter);
router.get('/:section/:id', sectionIdRouter);
router.get('/:section/:id/:supports', sectionIdSupportsRouter);

module.exports = router;
