const express = require("express");
const router = express.Router();
const {
    getGroups,
    getGroupById,
    createGroup,
    addMember,
    removeMember,
    addExpense,
    deleteExpense,
    deleteGroup,
    getSettlement
} = require("../controllers/groupController");
const { requireAuth, requireGroupAccess } = require("../middleware/auth");
const {
    sanitizeBody,
    validateGroup,
    validateMember,
    validateExpense
} = require("../middleware/validate");

// All group routes require valid authentication session
router.use(requireAuth);

// Group collection
router.get("/", getGroups);
router.post("/", sanitizeBody, validateGroup, createGroup);

// Specific group resources
router.get("/:groupId", requireGroupAccess, getGroupById);
router.delete("/:groupId", requireGroupAccess, deleteGroup);

// Members
router.post("/:groupId/members", requireGroupAccess, sanitizeBody, validateMember, addMember);
router.delete("/:groupId/members/:memberId", requireGroupAccess, removeMember);

// Expenses
router.post("/:groupId/expenses", requireGroupAccess, sanitizeBody, validateExpense, addExpense);
router.delete("/:groupId/expenses/:expenseId", requireGroupAccess, deleteExpense);

// Server-side Settlement Calculation
router.get("/:groupId/settle", requireGroupAccess, getSettlement);

module.exports = router;
