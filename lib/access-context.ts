import { AsyncLocalStorage } from "node:async_hooks";
export type ResourceType = "SPACE" | "LIST" | "TASK" | "DASHBOARD";
export type Level = "NONE" | "VIEW" | "COMMENT" | "EDIT";
export type Role = "OWNER" | "ADMIN" | "MEMBER" | "GUEST";
export type Grant = {
    resourceType: ResourceType;
    resourceId: string;
    level: Level;
};
export type Resource = {
    id: string;
    type: ResourceType;
    parentId?: string | null;
    parentType?: ResourceType;
    listId?: string;
    name?: string;
};
const ranks: Record<Level, number> = { NONE: 0, VIEW: 1, COMMENT: 2, EDIT: 3 };
export class Access {
    private nodes = new Map<string, Resource>();
    private grants = new Map<string, Level>();
    private restricted = new Set<string>();
    constructor(public role: Role, public scopeAll: boolean, resources: Resource[], grants: Grant[], restricted: string[] = []) {
        resources.forEach(r => this.nodes.set(`${r.type}:${r.id}`, r));
        grants.forEach(g => this.grants.set(`${g.resourceType}:${g.resourceId}`, g.level));
        restricted.forEach(k => this.restricted.add(k));
    }
    get admin() { return this.role === "OWNER" || this.role === "ADMIN"; }
    level(type: ResourceType, id: string, visited = new Set<string>()): Level {
        const key = `${type}:${id}`;
        if (!this.nodes.has(key) || visited.has(key))
            return "NONE";
        if (this.admin)
            return "EDIT";
        visited.add(key);
        const n = this.nodes.get(key)!;
        const direct = this.grants.get(key);
        let level: Level = direct ?? (this.restricted.has(key) ? "NONE" : n.parentId && n.parentType ? this.level(n.parentType, n.parentId, visited) : this.scopeAll ? "EDIT" : "NONE");
        if (this.role === "GUEST" && ranks[level] > 1)
            level = "VIEW";
        return level;
    }
    can(type: ResourceType, id: string, level: Level = "VIEW") { return ranks[this.level(type, id)] >= ranks[level]; }
    visibleList(id: string) { return this.can("LIST", id) || this.resources("TASK").some(t => t.listId === id && this.can("TASK", t.id)); }
    resources(type: ResourceType) { return [...this.nodes.values()].filter(n => n.type === type); }
    assert(type: ResourceType, id: string, level: Level = "VIEW") { if (!this.can(type, id, level))
        throw new AccessError(403, "No tenés permiso para este recurso."); }
}
export class AccessError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export type Actor = {
    user: {
        id: string;
        email: string;
        name: string;
        color: string;
        avatarUrl: string | null;
    };
    role: Role;
    workspaceId: string;
    kind: "local" | "native" | "token";
    tokenScope?: "read" | "write";
    channel?: "web" | "mcp" | "api";
    access: Access;
    sessionId?: string;
    clientId?: string;
};
const context = new AsyncLocalStorage<Actor>();
export function withActor<T>(actor: Actor, fn: () => T): T { return context.run(actor, fn); }
export function actorOrNull() { return context.getStore() ?? null; }
export function actor() { const a = actorOrNull(); if (!a)
    throw new AccessError(401, "Iniciá sesión para continuar."); return a; }
