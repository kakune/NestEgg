"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CsvModule = void 0;
const common_1 = require("@nestjs/common");
const csv_service_1 = require("./csv.service");
const csv_controller_1 = require("./csv.controller");
const prisma_module_1 = require("../prisma/prisma.module");
const transactions_module_1 = require("../transactions/transactions.module");
const incomes_module_1 = require("../incomes/incomes.module");
const actors_module_1 = require("../actors/actors.module");
const categories_module_1 = require("../categories/categories.module");
let CsvModule = class CsvModule {
};
exports.CsvModule = CsvModule;
exports.CsvModule = CsvModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            transactions_module_1.TransactionsModule,
            incomes_module_1.IncomesModule,
            actors_module_1.ActorsModule,
            categories_module_1.CategoriesModule,
        ],
        controllers: [csv_controller_1.CsvController],
        providers: [csv_service_1.CsvService],
        exports: [csv_service_1.CsvService],
    })
], CsvModule);
//# sourceMappingURL=csv.module.js.map