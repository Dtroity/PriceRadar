import type { TelegramUser } from '../types/index.js';
export declare function getTelegramUserByTelegramId(telegramId: string): Promise<TelegramUser | null>;
export declare function getAllTelegramUsers(): Promise<TelegramUser[]>;
export declare function getTelegramUsersByOrganization(organizationId: string): Promise<TelegramUser[]>;
export declare function createTelegramUser(telegramId: string, username: string | null, isAllowed?: boolean): Promise<TelegramUser>;
export declare function setTelegramUserAllowed(telegramId: string, isAllowed: boolean): Promise<void>;
/** super_admin с organizationId в JWT — привязывает пользователя к этой организации */
export declare function setTelegramUserAllowedWithOrg(telegramId: string, isAllowed: boolean, organizationId: string): Promise<void>;
export declare function setTelegramUserAllowedForOrganization(organizationId: string, telegramId: string, isAllowed: boolean): Promise<void>;
export declare function setTelegramUserRole(id: string, role: string): Promise<void>;
export declare function removeTelegramUser(id: string): Promise<void>;
export declare function removeTelegramUserForOrganization(organizationId: string, id: string): Promise<void>;
export declare function getAllowedTelegramIds(): Promise<string[]>;
export declare function getAllowedTelegramIdsForOrg(organizationId: string): Promise<string[]>;
