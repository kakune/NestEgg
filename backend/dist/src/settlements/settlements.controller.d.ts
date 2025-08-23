import { SettlementsService, SettlementWithLines } from './settlements.service';
import { AuthenticatedUser } from '../common/interfaces/auth-context.interface';
interface RunSettlementDto {
    year: number;
    month: number;
}
export declare class SettlementsController {
    private readonly settlementsService;
    constructor(settlementsService: SettlementsService);
    private getAuthContext;
    findAll(user: AuthenticatedUser): Promise<SettlementWithLines[]>;
    findOne(id: string, user: AuthenticatedUser): Promise<SettlementWithLines>;
    runSettlement(dto: RunSettlementDto, user: AuthenticatedUser): Promise<SettlementWithLines>;
    finalizeSettlement(id: string, user: AuthenticatedUser): Promise<SettlementWithLines>;
    findByMonth(): Promise<SettlementWithLines | null>;
}
export {};
