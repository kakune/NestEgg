import { ActorsService, CreateActorDto, UpdateActorDto } from './actors.service';
import { Actor } from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/auth-context.interface';
export declare class ActorsController {
    private readonly actorsService;
    constructor(actorsService: ActorsService);
    private getAuthContext;
    findAll(user: AuthenticatedUser): Promise<Actor[]>;
    findOne(id: string, user: AuthenticatedUser): Promise<Actor>;
    findByUserId(userId: string, user: AuthenticatedUser): Promise<Actor[]>;
    getActorStats(id: string, user: AuthenticatedUser): Promise<any>;
    create(createActorDto: CreateActorDto, user: AuthenticatedUser): Promise<Actor>;
    update(id: string, updateActorDto: UpdateActorDto, user: AuthenticatedUser): Promise<Actor>;
    remove(id: string, user: AuthenticatedUser): Promise<void>;
}
