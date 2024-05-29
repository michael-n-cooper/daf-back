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
    import ('../script/get.mjs').then(async(get) => {
        var val = await get.getId(req);
        res.json(val);
        next();
    });
}

router.get('/:section', sectionRouter);
router.get('/:section/:id', sectionIdRouter);

module.exports = router;
