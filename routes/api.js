var express = require('express');
var router = express.Router();

const sectionRouter = async function (req, res, next) {
    import ('../script/get.mjs').then(async(get) => {
        var val = await get.getSection(req);
        res.json(val);
        next();
    });
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
