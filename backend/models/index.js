// =========================================================================
// TỔNG HỢP VÀ XUẤT TOÀN BỘ DATA MODELS CHO RESTFUL API NHÀ HÀNG FOODHUB
// =========================================================================

const Branch = require('./Branch');
const Category = require('./Category');
const MenuItem = require('./MenuItem');
const Variant = require('./Variant');
const Ingredient = require('./Ingredient');
const Recipe = require('./Recipe');
const VariantRecipe = require('./VariantRecipe');
const Table = require('./Table');
const User = require('./User');
const Order = require('./Order');
const OrderDetail = require('./OrderDetail');
const Shift = require('./Shift');
const Payment = require('./Payment');
const LossReport = require('./LossReport');
const CashTransaction = require('./CashTransaction');
const Voucher = require('./Voucher');
const Customer = require('./Customer');
const Feedback = require('./Feedback');
const AuditLog = require('./AuditLog');

module.exports = {
    Branch,
    Category,
    MenuItem,
    Variant,
    Ingredient,
    Recipe,
    VariantRecipe,
    Table,
    User,
    UserModel: User,
    Order,
    OrderDetail,
    Shift,
    Payment,
    LossReport,
    CashTransaction,
    Voucher,
    Customer,
    Feedback,
    AuditLog
};
