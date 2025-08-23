"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionsController = void 0;
const common_1 = require("@nestjs/common");
const transactions_service_1 = require("./transactions.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const user_decorator_1 = require("../common/decorators/user.decorator");
let TransactionsController = class TransactionsController {
    transactionsService;
    constructor(transactionsService) {
        this.transactionsService = transactionsService;
    }
    getAuthContext(user) {
        return {
            userId: user.userId,
            householdId: user.householdId,
            role: user.role,
        };
    }
    async findAll(query, user) {
        const filters = this.buildFilters(query);
        return this.transactionsService.findAll(filters, this.getAuthContext(user));
    }
    async getTransactionSummary(query, user) {
        const filters = this.buildFilters(query);
        return this.transactionsService.getTransactionSummary(filters, this.getAuthContext(user));
    }
    async searchTransactions(searchQuery, query, user) {
        const filters = this.buildFilters(query);
        filters.search = searchQuery;
        filters.limit = filters.limit || 50;
        filters.sortBy = 'date';
        filters.sortOrder = 'desc';
        return this.transactionsService.findAll(filters, this.getAuthContext(user));
    }
    async findByCategory(categoryId, query, user) {
        const filters = this.buildFilters(query);
        filters.categoryIds = [categoryId];
        return this.transactionsService.findAll(filters, this.getAuthContext(user));
    }
    async findByActor(actorId, query, user) {
        const filters = this.buildFilters(query);
        filters.actorIds = [actorId];
        return this.transactionsService.findAll(filters, this.getAuthContext(user));
    }
    async findByTag(tag, query, user) {
        const filters = this.buildFilters(query);
        filters.tags = [tag];
        filters.sortBy = 'date';
        filters.sortOrder = 'desc';
        return this.transactionsService.findAll(filters, this.getAuthContext(user));
    }
    async findRecent(limit = '20', user) {
        const filters = {
            limit: parseInt(limit),
            sortBy: 'date',
            sortOrder: 'desc',
        };
        return this.transactionsService.findAll(filters, this.getAuthContext(user));
    }
    async findByDateRange(from, to, query, user) {
        const filters = this.buildFilters(query);
        filters.dateFrom = new Date(from);
        filters.dateTo = new Date(to);
        filters.sortBy = filters.sortBy || 'date';
        filters.sortOrder = filters.sortOrder || 'desc';
        return this.transactionsService.findAll(filters, this.getAuthContext(user));
    }
    async findOne(id, user) {
        return this.transactionsService.findOne(id, this.getAuthContext(user));
    }
    async create(createTransactionDto, user) {
        return this.transactionsService.create(createTransactionDto, this.getAuthContext(user));
    }
    async createBulk(createTransactionDtos, user) {
        const authContext = this.getAuthContext(user);
        const results = [];
        for (const dto of createTransactionDtos) {
            try {
                const transaction = await this.transactionsService.create(dto, authContext);
                results.push(transaction);
            }
            catch (error) {
                console.error(`Failed to create transaction: ${dto.description}`, error);
            }
        }
        return results;
    }
    async update(id, updateTransactionDto, user) {
        return this.transactionsService.update(id, updateTransactionDto, this.getAuthContext(user));
    }
    async remove(id, user) {
        await this.transactionsService.remove(id, this.getAuthContext(user));
    }
    async removeBulk(ids, user) {
        const authContext = this.getAuthContext(user);
        for (const id of ids) {
            try {
                await this.transactionsService.remove(id, authContext);
            }
            catch (error) {
                console.error(`Failed to delete transaction: ${id}`, error);
            }
        }
    }
    buildFilters(query) {
        const filters = {};
        if (query.dateFrom)
            filters.dateFrom = new Date(query.dateFrom);
        if (query.dateTo)
            filters.dateTo = new Date(query.dateTo);
        if (query.categoryIds)
            filters.categoryIds = Array.isArray(query.categoryIds)
                ? query.categoryIds
                : [query.categoryIds];
        if (query.actorIds)
            filters.actorIds = Array.isArray(query.actorIds)
                ? query.actorIds
                : [query.actorIds];
        if (query.types)
            filters.types = Array.isArray(query.types) ? query.types : [query.types];
        if (query.tags)
            filters.tags = Array.isArray(query.tags) ? query.tags : [query.tags];
        if (query.search)
            filters.search = query.search;
        if (query.shouldPay !== undefined)
            filters.shouldPay = query.shouldPay === 'true';
        if (query.amountFrom)
            filters.amountFrom = parseInt(query.amountFrom);
        if (query.amountTo)
            filters.amountTo = parseInt(query.amountTo);
        if (query.limit)
            filters.limit = parseInt(query.limit);
        if (query.offset)
            filters.offset = parseInt(query.offset);
        if (query.sortBy)
            filters.sortBy = query.sortBy;
        if (query.sortOrder)
            filters.sortOrder = query.sortOrder;
        return filters;
    }
};
exports.TransactionsController = TransactionsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "getTransactionSummary", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "searchTransactions", null);
__decorate([
    (0, common_1.Get)('by-category/:categoryId'),
    __param(0, (0, common_1.Param)('categoryId')),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "findByCategory", null);
__decorate([
    (0, common_1.Get)('by-actor/:actorId'),
    __param(0, (0, common_1.Param)('actorId')),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "findByActor", null);
__decorate([
    (0, common_1.Get)('by-tag/:tag'),
    __param(0, (0, common_1.Param)('tag')),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "findByTag", null);
__decorate([
    (0, common_1.Get)('recent'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "findRecent", null);
__decorate([
    (0, common_1.Get)('date-range/:from/:to'),
    __param(0, (0, common_1.Param)('from')),
    __param(1, (0, common_1.Param)('to')),
    __param(2, (0, common_1.Query)()),
    __param(3, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "findByDateRange", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('bulk'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "createBulk", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "remove", null);
__decorate([
    (0, common_1.Delete)('bulk'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "removeBulk", null);
exports.TransactionsController = TransactionsController = __decorate([
    (0, common_1.Controller)('transactions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [transactions_service_1.TransactionsService])
], TransactionsController);
//# sourceMappingURL=transactions.controller.js.map