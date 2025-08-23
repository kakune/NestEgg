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
exports.CsvController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const csv_service_1 = require("./csv.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const user_decorator_1 = require("../common/decorators/user.decorator");
let CsvController = class CsvController {
    csvService;
    constructor(csvService) {
        this.csvService = csvService;
    }
    getAuthContext(user) {
        return {
            userId: user.userId,
            householdId: user.householdId,
            role: user.role,
        };
    }
    uploadTransactionFile(file) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded');
        }
        if (!file.originalname.toLowerCase().endsWith('.csv')) {
            throw new common_1.BadRequestException('Only CSV files are allowed');
        }
        const csvData = file.buffer.toString('utf-8');
        const lines = csvData.split('\n');
        const headers = lines[0]
            ? lines[0].split(',').map((h) => h.trim().replace(/"/g, ''))
            : [];
        return {
            fileName: file.originalname,
            fileSize: file.size,
            rowCount: lines.length - 1,
            headers,
            sampleData: lines.slice(1, 4).map((line) => {
                const values = line.split(',').map((v) => v.trim().replace(/"/g, ''));
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                return row;
            }),
        };
    }
    async previewTransactionImport(dto, user) {
        return this.csvService.previewTransactionImport(dto.csvData, dto.fieldMapping, this.getAuthContext(user));
    }
    async importTransactions(dto, user) {
        return this.csvService.importTransactions(dto.csvData, dto.fieldMapping, this.getAuthContext(user), dto.skipDuplicates ?? true);
    }
    async exportTransactions(query, user, res) {
        const authContext = this.getAuthContext(user);
        const filters = {
            dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
            dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
            categoryIds: query.categoryIds
                ? Array.isArray(query.categoryIds)
                    ? query.categoryIds
                    : [query.categoryIds]
                : undefined,
            actorIds: query.actorIds
                ? Array.isArray(query.actorIds)
                    ? query.actorIds
                    : [query.actorIds]
                : undefined,
            types: query.types
                ? Array.isArray(query.types)
                    ? query.types
                    : [query.types]
                : undefined,
            tags: query.tags
                ? Array.isArray(query.tags)
                    ? query.tags
                    : [query.tags]
                : undefined,
            search: query.search,
        };
        const options = {
            format: query.format === 'json' ? 'json' : 'csv',
            dateFormat: query.dateFormat || 'iso',
            includeHeaders: query.includeHeaders !== 'false',
        };
        const exportData = await this.csvService.exportTransactions(filters, options, authContext);
        const timestamp = new Date().toISOString().split('T')[0];
        const fileName = `transactions_${timestamp}.${options.format}`;
        res.setHeader('Content-Type', options.format === 'json' ? 'application/json' : 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(exportData);
    }
    uploadIncomeFile(file) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded');
        }
        if (!file.originalname.toLowerCase().endsWith('.csv')) {
            throw new common_1.BadRequestException('Only CSV files are allowed');
        }
        const csvData = file.buffer.toString('utf-8');
        const lines = csvData.split('\n');
        const headers = lines[0]
            ? lines[0].split(',').map((h) => h.trim().replace(/"/g, ''))
            : [];
        return {
            fileName: file.originalname,
            fileSize: file.size,
            rowCount: lines.length - 1,
            headers,
            sampleData: lines.slice(1, 4).map((line) => {
                const values = line.split(',').map((v) => v.trim().replace(/"/g, ''));
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                return row;
            }),
        };
    }
    async importIncomes(dto, user) {
        return this.csvService.importIncomes(dto.csvData, dto.fieldMapping, this.getAuthContext(user), dto.skipDuplicates ?? true);
    }
    async exportIncomes(query, user, res) {
        const authContext = this.getAuthContext(user);
        const filters = {
            userId: query.userId,
            year: query.year ? parseInt(query.year) : undefined,
            month: query.month ? parseInt(query.month) : undefined,
            yearFrom: query.yearFrom ? parseInt(query.yearFrom) : undefined,
            yearTo: query.yearTo ? parseInt(query.yearTo) : undefined,
        };
        const options = {
            format: query.format === 'json' ? 'json' : 'csv',
            dateFormat: query.dateFormat || 'iso',
            includeHeaders: query.includeHeaders !== 'false',
        };
        const exportData = await this.csvService.exportIncomes(filters, options, authContext);
        const timestamp = new Date().toISOString().split('T')[0];
        const fileName = `incomes_${timestamp}.${options.format}`;
        res.setHeader('Content-Type', options.format === 'json' ? 'application/json' : 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(exportData);
    }
    getTransactionTemplate(res) {
        const template = `amount,type,description,date,categoryId,actorId,tags,notes,shouldPay
-500,expense,"Grocery shopping",2024-01-15,cat-food-id,actor-user1-id,"groceries;food","Weekly shopping",true
2000,income,"Salary",2024-01-31,cat-salary-id,actor-user1-id,"salary","Monthly salary",false`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="transaction_template.csv"');
        res.send(template);
    }
    getIncomeTemplate(res) {
        const template = `userId,grossIncomeYen,deductionYen,year,month,description,sourceDocument
user-id-1,300000,50000,2024,1,"January salary","Payslip Jan 2024"
user-id-1,320000,52000,2024,2,"February salary","Payslip Feb 2024"`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="income_template.csv"');
        res.send(template);
    }
    getTransactionFieldMappings() {
        return [
            {
                csvField: 'amount',
                systemField: 'amount',
                required: true,
                transform: 'number',
            },
            {
                csvField: 'type',
                systemField: 'type',
                required: true,
                transform: 'enum',
                enumValues: ['income', 'expense'],
            },
            {
                csvField: 'description',
                systemField: 'description',
                required: true,
                transform: 'string',
            },
            {
                csvField: 'date',
                systemField: 'date',
                required: true,
                transform: 'date',
            },
            {
                csvField: 'categoryId',
                systemField: 'categoryId',
                required: true,
                transform: 'string',
            },
            {
                csvField: 'actorId',
                systemField: 'actorId',
                required: true,
                transform: 'string',
            },
            {
                csvField: 'tags',
                systemField: 'tags',
                required: false,
                transform: 'string',
                defaultValue: [],
            },
            {
                csvField: 'notes',
                systemField: 'notes',
                required: false,
                transform: 'string',
            },
            {
                csvField: 'shouldPay',
                systemField: 'shouldPay',
                required: false,
                transform: 'boolean',
            },
        ];
    }
    getIncomeFieldMappings() {
        return [
            {
                csvField: 'userId',
                systemField: 'userId',
                required: true,
                transform: 'string',
            },
            {
                csvField: 'grossIncomeYen',
                systemField: 'grossIncomeYen',
                required: true,
                transform: 'number',
            },
            {
                csvField: 'deductionYen',
                systemField: 'deductionYen',
                required: true,
                transform: 'number',
                defaultValue: 0,
            },
            {
                csvField: 'year',
                systemField: 'year',
                required: true,
                transform: 'number',
            },
            {
                csvField: 'month',
                systemField: 'month',
                required: true,
                transform: 'number',
            },
            {
                csvField: 'description',
                systemField: 'description',
                required: false,
                transform: 'string',
            },
            {
                csvField: 'sourceDocument',
                systemField: 'sourceDocument',
                required: false,
                transform: 'string',
            },
        ];
    }
};
exports.CsvController = CsvController;
__decorate([
    (0, common_1.Post)('transactions/upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CsvController.prototype, "uploadTransactionFile", null);
__decorate([
    (0, common_1.Post)('transactions/preview'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CsvController.prototype, "previewTransactionImport", null);
__decorate([
    (0, common_1.Post)('transactions/import'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CsvController.prototype, "importTransactions", null);
__decorate([
    (0, common_1.Get)('transactions/export'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], CsvController.prototype, "exportTransactions", null);
__decorate([
    (0, common_1.Post)('incomes/upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CsvController.prototype, "uploadIncomeFile", null);
__decorate([
    (0, common_1.Post)('incomes/import'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CsvController.prototype, "importIncomes", null);
__decorate([
    (0, common_1.Get)('incomes/export'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], CsvController.prototype, "exportIncomes", null);
__decorate([
    (0, common_1.Get)('transactions/template'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CsvController.prototype, "getTransactionTemplate", null);
__decorate([
    (0, common_1.Get)('incomes/template'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CsvController.prototype, "getIncomeTemplate", null);
__decorate([
    (0, common_1.Get)('field-mappings/transactions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Array)
], CsvController.prototype, "getTransactionFieldMappings", null);
__decorate([
    (0, common_1.Get)('field-mappings/incomes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Array)
], CsvController.prototype, "getIncomeFieldMappings", null);
exports.CsvController = CsvController = __decorate([
    (0, common_1.Controller)('csv'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [csv_service_1.CsvService])
], CsvController);
//# sourceMappingURL=csv.controller.js.map