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
exports.IncomesController = void 0;
const common_1 = require("@nestjs/common");
const incomes_service_1 = require("./incomes.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const user_decorator_1 = require("../common/decorators/user.decorator");
let IncomesController = class IncomesController {
    incomesService;
    constructor(incomesService) {
        this.incomesService = incomesService;
    }
    getAuthContext(user) {
        return {
            userId: user.userId,
            householdId: user.householdId,
            role: user.role,
        };
    }
    async findAll(query, user) {
        const authContext = this.getAuthContext(user);
        const filters = {
            userId: query.userId,
            year: query.year ? parseInt(query.year) : undefined,
            month: query.month ? parseInt(query.month) : undefined,
            yearFrom: query.yearFrom ? parseInt(query.yearFrom) : undefined,
            yearTo: query.yearTo ? parseInt(query.yearTo) : undefined,
            minAllocatable: query.minAllocatable
                ? parseInt(query.minAllocatable)
                : undefined,
            maxAllocatable: query.maxAllocatable
                ? parseInt(query.maxAllocatable)
                : undefined,
            search: query.search,
            limit: query.limit ? parseInt(query.limit) : undefined,
            offset: query.offset ? parseInt(query.offset) : undefined,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
        };
        return this.incomesService.findAll(filters, authContext);
    }
    async getStatistics(query, user) {
        const authContext = this.getAuthContext(user);
        const filters = {
            userId: query.userId,
            yearFrom: query.yearFrom ? parseInt(query.yearFrom) : undefined,
            yearTo: query.yearTo ? parseInt(query.yearTo) : undefined,
        };
        return this.incomesService.getIncomeStatistics(filters, authContext);
    }
    async getHouseholdBreakdown(year, month, user) {
        const authContext = this.getAuthContext(user);
        const yearNum = parseInt(year);
        const monthNum = month ? parseInt(month) : undefined;
        return this.incomesService.getHouseholdIncomeBreakdown(yearNum, monthNum, authContext);
    }
    async findByUser(userId, query, user) {
        const authContext = this.getAuthContext(user);
        const filters = {
            userId,
            year: query.year ? parseInt(query.year) : undefined,
            month: query.month ? parseInt(query.month) : undefined,
            yearFrom: query.yearFrom ? parseInt(query.yearFrom) : undefined,
            yearTo: query.yearTo ? parseInt(query.yearTo) : undefined,
            limit: query.limit ? parseInt(query.limit) : undefined,
            offset: query.offset ? parseInt(query.offset) : undefined,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
        };
        return this.incomesService.findAll(filters, authContext);
    }
    async findByUserAndYear(userId, year, user) {
        const authContext = this.getAuthContext(user);
        const filters = {
            userId,
            year: parseInt(year),
            sortBy: 'month',
            sortOrder: 'asc',
        };
        return this.incomesService.findAll(filters, authContext);
    }
    async findByUserAndMonth(userId, year, month, user) {
        return this.incomesService.findByUserAndMonth(userId, parseInt(year), parseInt(month), this.getAuthContext(user));
    }
    async findByYear(year, query, user) {
        const authContext = this.getAuthContext(user);
        const filters = {
            year: parseInt(year),
            month: query.month ? parseInt(query.month) : undefined,
            userId: query.userId,
            limit: query.limit ? parseInt(query.limit) : undefined,
            offset: query.offset ? parseInt(query.offset) : undefined,
            sortBy: query.sortBy || 'month',
            sortOrder: query.sortOrder || 'asc',
        };
        return this.incomesService.findAll(filters, authContext);
    }
    async searchIncomes(searchQuery, query, user) {
        const authContext = this.getAuthContext(user);
        const filters = {
            search: searchQuery,
            userId: query.userId,
            year: query.year ? parseInt(query.year) : undefined,
            yearFrom: query.yearFrom ? parseInt(query.yearFrom) : undefined,
            yearTo: query.yearTo ? parseInt(query.yearTo) : undefined,
            limit: query.limit ? parseInt(query.limit) : 50,
            offset: query.offset ? parseInt(query.offset) : undefined,
            sortBy: 'year',
            sortOrder: 'desc',
        };
        return this.incomesService.findAll(filters, authContext);
    }
    async findRecent(limit = '12', user) {
        const authContext = this.getAuthContext(user);
        const filters = {
            limit: parseInt(limit),
            sortBy: 'year',
            sortOrder: 'desc',
        };
        return this.incomesService.findAll(filters, authContext);
    }
    async findCurrentYear(userId, user) {
        const authContext = this.getAuthContext(user);
        const currentYear = new Date().getFullYear();
        const filters = {
            year: currentYear,
            userId,
            sortBy: 'month',
            sortOrder: 'asc',
        };
        return this.incomesService.findAll(filters, authContext);
    }
    async findOne(id, user) {
        return this.incomesService.findOne(id, this.getAuthContext(user));
    }
    async create(createIncomeDto, user) {
        return this.incomesService.create(createIncomeDto, this.getAuthContext(user));
    }
    async createBulk(createIncomeDtos, user) {
        const authContext = this.getAuthContext(user);
        const results = [];
        for (const dto of createIncomeDtos) {
            try {
                const income = await this.incomesService.create(dto, authContext);
                results.push(income);
            }
            catch (error) {
                console.error(`Failed to create income for ${dto.userId} ${dto.year}-${dto.month}`, error);
            }
        }
        return results;
    }
    async update(id, updateIncomeDto, user) {
        return this.incomesService.update(id, updateIncomeDto, this.getAuthContext(user));
    }
    async remove(id, user) {
        await this.incomesService.remove(id, this.getAuthContext(user));
    }
    async removeByUserAndYear(userId, year, user) {
        const authContext = this.getAuthContext(user);
        const filters = {
            userId,
            year: parseInt(year),
        };
        const incomes = await this.incomesService.findAll(filters, authContext);
        for (const income of incomes) {
            try {
                await this.incomesService.remove(income.id, authContext);
            }
            catch (error) {
                console.error(`Failed to delete income: ${income.id}`, error);
            }
        }
    }
};
exports.IncomesController = IncomesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IncomesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('statistics'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IncomesController.prototype, "getStatistics", null);
__decorate([
    (0, common_1.Get)('breakdown/:year'),
    __param(0, (0, common_1.Param)('year')),
    __param(1, (0, common_1.Query)('month')),
    __param(2, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], IncomesController.prototype, "getHouseholdBreakdown", null);
__decorate([
    (0, common_1.Get)('user/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], IncomesController.prototype, "findByUser", null);
__decorate([
    (0, common_1.Get)('user/:userId/year/:year'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Param)('year')),
    __param(2, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], IncomesController.prototype, "findByUserAndYear", null);
__decorate([
    (0, common_1.Get)('user/:userId/month/:year/:month'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Param)('year')),
    __param(2, (0, common_1.Param)('month')),
    __param(3, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], IncomesController.prototype, "findByUserAndMonth", null);
__decorate([
    (0, common_1.Get)('year/:year'),
    __param(0, (0, common_1.Param)('year')),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], IncomesController.prototype, "findByYear", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], IncomesController.prototype, "searchIncomes", null);
__decorate([
    (0, common_1.Get)('recent'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], IncomesController.prototype, "findRecent", null);
__decorate([
    (0, common_1.Get)('current-year'),
    __param(0, (0, common_1.Query)('userId')),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], IncomesController.prototype, "findCurrentYear", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], IncomesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IncomesController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('bulk'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], IncomesController.prototype, "createBulk", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], IncomesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], IncomesController.prototype, "remove", null);
__decorate([
    (0, common_1.Delete)('user/:userId/year/:year'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Param)('year')),
    __param(2, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], IncomesController.prototype, "removeByUserAndYear", null);
exports.IncomesController = IncomesController = __decorate([
    (0, common_1.Controller)('incomes'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [incomes_service_1.IncomesService])
], IncomesController);
//# sourceMappingURL=incomes.controller.js.map