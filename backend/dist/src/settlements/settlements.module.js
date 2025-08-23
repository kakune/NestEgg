"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementsModule = void 0;
const common_1 = require("@nestjs/common");
const settlements_service_1 = require("./settlements.service");
const settlements_controller_1 = require("./settlements.controller");
const prisma_module_1 = require("../prisma/prisma.module");
let SettlementsModule = class SettlementsModule {
};
exports.SettlementsModule = SettlementsModule;
exports.SettlementsModule = SettlementsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [settlements_controller_1.SettlementsController],
        providers: [settlements_service_1.SettlementsService],
        exports: [settlements_service_1.SettlementsService],
    })
], SettlementsModule);
//# sourceMappingURL=settlements.module.js.map