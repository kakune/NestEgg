"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CsvService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const transactions_service_1 = require("../transactions/transactions.service");
const incomes_service_1 = require("../incomes/incomes.service");
const actors_service_1 = require("../actors/actors.service");
const categories_service_1 = require("../categories/categories.service");
const client_1 = require("@prisma/client");
const Papa = __importStar(require("papaparse"));
const crypto = __importStar(require("crypto"));
let CsvService = class CsvService {
    prismaService;
    transactionsService;
    incomesService;
    actorsService;
    categoriesService;
    constructor(prismaService, transactionsService, incomesService, actorsService, categoriesService) {
        this.prismaService = prismaService;
        this.transactionsService = transactionsService;
        this.incomesService = incomesService;
        this.actorsService = actorsService;
        this.categoriesService = categoriesService;
    }
    async previewTransactionImport(csvData, fieldMapping, authContext) {
        const parsed = Papa.parse(csvData, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
        });
        if (parsed.errors.length > 0) {
            throw new common_1.BadRequestException('CSV parsing failed: ' + parsed.errors.map((e) => e.message).join(', '));
        }
        const preview = {
            totalRows: parsed.data.length,
            validRows: 0,
            invalidRows: 0,
            duplicateRows: 0,
            sampleData: [],
            errors: [],
            warnings: [],
        };
        const duplicateHashes = new Set();
        const existingHashes = await this.getExistingTransactionHashes(authContext);
        for (let i = 0; i < Math.min(parsed.data.length, 1000); i++) {
            const row = parsed.data[i];
            const rowNumber = i + 2;
            try {
                const mappedData = this.mapRowData(row, fieldMapping);
                const validationResult = await this.validateTransactionRow(mappedData, authContext);
                if (validationResult.isValid) {
                    preview.validRows++;
                    const sourceHash = this.generateTransactionHash(mappedData);
                    if (existingHashes.has(sourceHash) ||
                        duplicateHashes.has(sourceHash)) {
                        preview.duplicateRows++;
                        preview.warnings.push({
                            row: rowNumber,
                            field: 'duplicate',
                            value: sourceHash,
                            message: 'Duplicate transaction detected',
                        });
                    }
                    else {
                        duplicateHashes.add(sourceHash);
                    }
                    if (preview.sampleData.length < 5) {
                        preview.sampleData.push(mappedData);
                    }
                }
                else {
                    preview.invalidRows++;
                    preview.errors.push(...validationResult.errors.map((error) => ({
                        ...error,
                        row: rowNumber,
                    })));
                }
            }
            catch (error) {
                preview.invalidRows++;
                preview.errors.push({
                    row: rowNumber,
                    field: 'general',
                    value: '',
                    message: error instanceof Error ? error.message : 'Unknown error occurred',
                });
            }
        }
        return preview;
    }
    async importTransactions(csvData, fieldMapping, authContext, skipDuplicates = true) {
        const parsed = Papa.parse(csvData, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
        });
        if (parsed.errors.length > 0) {
            throw new common_1.BadRequestException('CSV parsing failed: ' + parsed.errors.map((e) => e.message).join(', '));
        }
        const result = {
            totalProcessed: parsed.data.length,
            successful: 0,
            failed: 0,
            duplicates: 0,
            errors: [],
        };
        const existingHashes = await this.getExistingTransactionHashes(authContext);
        const processedHashes = new Set();
        for (let i = 0; i < parsed.data.length; i++) {
            const row = parsed.data[i];
            const rowNumber = i + 2;
            try {
                const mappedData = this.mapRowData(row, fieldMapping);
                const validationResult = await this.validateTransactionRow(mappedData, authContext);
                if (!validationResult.isValid) {
                    result.failed++;
                    result.errors.push(...validationResult.errors.map((error) => ({
                        ...error,
                        row: rowNumber,
                    })));
                    continue;
                }
                const sourceHash = this.generateTransactionHash(mappedData);
                if (existingHashes.has(sourceHash) || processedHashes.has(sourceHash)) {
                    result.duplicates++;
                    if (!skipDuplicates) {
                        result.errors.push({
                            row: rowNumber,
                            field: 'duplicate',
                            value: sourceHash,
                            message: 'Duplicate transaction',
                        });
                    }
                    continue;
                }
                await this.transactionsService.create({
                    ...mappedData,
                    sourceHash,
                }, authContext);
                result.successful++;
                processedHashes.add(sourceHash);
            }
            catch (error) {
                result.failed++;
                result.errors.push({
                    row: rowNumber,
                    field: 'general',
                    value: '',
                    message: error instanceof Error
                        ? error.message
                        : 'Failed to create transaction',
                });
            }
        }
        return result;
    }
    async exportTransactions(filters, options, authContext) {
        const transactions = await this.transactionsService.findAll(filters, authContext);
        const exportData = transactions.map((transaction) => ({
            id: transaction.id,
            amount: Number(transaction.amount),
            type: transaction.type,
            description: String(transaction.description),
            date: this.formatDate(new Date(String(transaction.date)), String(options.dateFormat)),
            category: transaction.category.name,
            categoryId: transaction.categoryId,
            actor: transaction.actor.name,
            actorId: String(transaction.actorId),
            tags: transaction.tags.join(';'),
            notes: String(transaction.notes || ''),
            shouldPay: transaction.shouldPay,
            createdAt: this.formatDate(transaction.createdAt, String(options.dateFormat)),
        }));
        if (options.format === 'json') {
            return JSON.stringify(exportData, null, 2);
        }
        return Papa.unparse(exportData, {
            header: options.includeHeaders !== false,
        });
    }
    async importIncomes(csvData, fieldMapping, authContext, skipDuplicates = true) {
        const parsed = Papa.parse(csvData, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
        });
        if (parsed.errors.length > 0) {
            throw new common_1.BadRequestException('CSV parsing failed: ' + parsed.errors.map((e) => e.message).join(', '));
        }
        const result = {
            totalProcessed: parsed.data.length,
            successful: 0,
            failed: 0,
            duplicates: 0,
            errors: [],
        };
        for (let i = 0; i < parsed.data.length; i++) {
            const row = parsed.data[i];
            const rowNumber = i + 2;
            try {
                const mappedData = this.mapRowData(row, fieldMapping);
                const validationResult = await this.validateIncomeRow(mappedData, authContext);
                if (!validationResult.isValid) {
                    result.failed++;
                    result.errors.push(...validationResult.errors.map((error) => ({
                        ...error,
                        row: rowNumber,
                    })));
                    continue;
                }
                const existingIncome = await this.incomesService.findByUserAndMonth(mappedData.userId, mappedData.year, mappedData.month, authContext);
                if (existingIncome) {
                    result.duplicates++;
                    if (!skipDuplicates) {
                        result.errors.push({
                            row: rowNumber,
                            field: 'duplicate',
                            value: `${String(mappedData.userId || '')}-${String(mappedData.year || '')}-${String(mappedData.month || '')}`,
                            message: 'Income for this user/month already exists',
                        });
                    }
                    continue;
                }
                await this.incomesService.create(mappedData, authContext);
                result.successful++;
            }
            catch (error) {
                result.failed++;
                result.errors.push({
                    row: rowNumber,
                    field: 'general',
                    value: '',
                    message: error instanceof Error ? error.message : 'Failed to create income',
                });
            }
        }
        return result;
    }
    async exportIncomes(filters, options, authContext) {
        const incomes = await this.incomesService.findAll(filters, authContext);
        const exportData = incomes.map((income) => ({
            id: income.id,
            userId: income.userId,
            userName: income.user.name,
            userEmail: income.user.email,
            grossIncomeYen: Number(income.grossIncomeYen),
            deductionYen: Number(income.deductionYen),
            allocatableYen: Number(income.allocatableYen),
            year: Number(income.year),
            month: Number(income.month),
            description: String(income.description || ''),
            sourceDocument: String(income.sourceDocument || ''),
            createdAt: this.formatDate(income.createdAt, options.dateFormat),
        }));
        if (options.format === 'json') {
            return JSON.stringify(exportData, null, 2);
        }
        return Papa.unparse(exportData, {
            header: options.includeHeaders !== false,
        });
    }
    mapRowData(row, fieldMapping) {
        const mappedData = {};
        for (const mapping of fieldMapping) {
            const csvValue = row[mapping.csvField];
            let systemValue = csvValue;
            if (!csvValue && mapping.defaultValue !== undefined) {
                systemValue = mapping.defaultValue;
            }
            if (systemValue && mapping.transform) {
                systemValue = this.transformValue(systemValue, mapping.transform, mapping.enumValues);
            }
            if (mapping.required && !systemValue && systemValue !== 0) {
                throw new common_1.BadRequestException(`Required field '${mapping.systemField}' is missing`);
            }
            mappedData[mapping.systemField] = systemValue;
        }
        return mappedData;
    }
    transformValue(value, transform, enumValues) {
        switch (transform) {
            case 'date': {
                const date = new Date(value);
                if (isNaN(date.getTime())) {
                    throw new common_1.BadRequestException(`Invalid date format: ${value}`);
                }
                return date;
            }
            case 'number': {
                const num = parseFloat(String(value));
                if (isNaN(num)) {
                    throw new common_1.BadRequestException(`Invalid number format: ${value}`);
                }
                return num;
            }
            case 'boolean':
                return ['true', '1', 'yes', 'y'].includes(value.toString().toLowerCase());
            case 'enum':
                if (enumValues && !enumValues.includes(value)) {
                    throw new common_1.BadRequestException(`Invalid enum value: ${value}. Must be one of: ${enumValues.join(', ')}`);
                }
                return value;
            case 'string':
            default:
                return value.toString();
        }
    }
    async validateTransactionRow(data, authContext) {
        const errors = [];
        if (!Number.isInteger(data.amount) || data.amount === 0) {
            errors.push({
                row: 0,
                field: 'amount',
                value: data.amount,
                message: 'Amount must be a non-zero integer',
            });
        }
        if (data.type === client_1.TransactionType.income && data.amount < 0) {
            errors.push({
                row: 0,
                field: 'type',
                value: data.type,
                message: 'Income transactions must have positive amounts',
            });
        }
        else if (data.type === client_1.TransactionType.expense && data.amount > 0) {
            errors.push({
                row: 0,
                field: 'type',
                value: data.type,
                message: 'Expense transactions must have negative amounts',
            });
        }
        try {
            await this.categoriesService.findOne(data.categoryId, authContext);
        }
        catch {
            errors.push({
                row: 0,
                field: 'categoryId',
                value: data.categoryId,
                message: 'Category not found',
            });
        }
        try {
            await this.actorsService.findOne(data.actorId, authContext);
        }
        catch {
            errors.push({
                row: 0,
                field: 'actorId',
                value: data.actorId,
                message: 'Actor not found',
            });
        }
        return {
            isValid: errors.length === 0,
            errors,
        };
    }
    async validateIncomeRow(data, authContext) {
        const errors = [];
        if (!Number.isInteger(data.grossIncomeYen) || data.grossIncomeYen < 0) {
            errors.push({
                row: 0,
                field: 'grossIncomeYen',
                value: data.grossIncomeYen,
                message: 'Gross income must be a non-negative integer',
            });
        }
        if (!Number.isInteger(data.deductionYen) || data.deductionYen < 0) {
            errors.push({
                row: 0,
                field: 'deductionYen',
                value: data.deductionYen,
                message: 'Deduction must be a non-negative integer',
            });
        }
        if (data.deductionYen > data.grossIncomeYen) {
            errors.push({
                row: 0,
                field: 'deductionYen',
                value: data.deductionYen,
                message: 'Deduction cannot exceed gross income',
            });
        }
        const currentYear = new Date().getFullYear();
        if (data.year < 1900 || data.year > currentYear + 5) {
            errors.push({
                row: 0,
                field: 'year',
                value: data.year,
                message: `Year must be between 1900 and ${currentYear + 5}`,
            });
        }
        if (data.month < 1 || data.month > 12) {
            errors.push({
                row: 0,
                field: 'month',
                value: data.month,
                message: 'Month must be between 1 and 12',
            });
        }
        const user = await this.prismaService.prisma.user.findFirst({
            where: {
                id: data.userId,
                householdId: authContext.householdId,
                deletedAt: null,
            },
        });
        if (!user) {
            errors.push({
                row: 0,
                field: 'userId',
                value: data.userId,
                message: 'User not found or does not belong to household',
            });
        }
        return {
            isValid: errors.length === 0,
            errors,
        };
    }
    async getExistingTransactionHashes(authContext) {
        return this.prismaService.withContext(authContext, async (prisma) => {
            const transactions = await prisma.transaction.findMany({
                where: {
                    householdId: authContext.householdId,
                    sourceHash: { not: null },
                },
                select: { sourceHash: true },
            });
            return new Set(transactions.map((t) => t.sourceHash).filter(Boolean));
        });
    }
    generateTransactionHash(data) {
        const hashInput = `${data.amount}-${data.date.toISOString()}-${data.description}-${data.actorId}-${data.categoryId}`;
        return crypto.createHash('sha256').update(hashInput).digest('hex');
    }
    formatDate(date, format) {
        if (!format) {
            return date.toISOString().split('T')[0];
        }
        switch (format) {
            case 'iso':
                return date.toISOString();
            case 'us':
                return date.toLocaleDateString('en-US');
            case 'eu':
                return date.toLocaleDateString('en-GB');
            default:
                return date.toISOString().split('T')[0];
        }
    }
};
exports.CsvService = CsvService;
exports.CsvService = CsvService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        transactions_service_1.TransactionsService,
        incomes_service_1.IncomesService,
        actors_service_1.ActorsService,
        categories_service_1.CategoriesService])
], CsvService);
//# sourceMappingURL=csv.service.js.map