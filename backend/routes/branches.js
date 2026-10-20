// Chuyển hướng và xử lý API Chi nhánh nhà hàng
var express = require('express');
var router = express.Router();
const { Branch } = require('../models');

/**
 * =========================================================================
 * BRANCHES (QUẢN LÝ CHI NHÁNH NHÀ HÀNG)
 * =========================================================================
 */

// GET http://localhost:4000/branches hoặc /api/branches
router.get('/', async (req, res) => {
    try {
        const branches = await Branch.find();
        res.status(200).json({
            status: 1,
            message: "Lấy danh sách chi nhánh thành công",
            data: branches
        });
    } catch (err) {
        res.status(500).json({ status: 0, message: "Lỗi tải chi nhánh", err: err.message });
    }
});

// GET http://localhost:4000/branches/:id
router.get('/:id', async (req, res) => {
    try {
        const branch = await Branch.findById(req.params.id);
        if (!branch) return res.status(404).json({ status: 0, message: "Chi nhánh không tồn tại" });
        res.status(200).json({ status: 1, data: branch });
    } catch (err) {
        res.status(500).json({ status: 0, message: "Lỗi", err: err.message });
    }
});

module.exports = router;
