import { AccessError, type Actor, type ResourceType, type Level } from './access-context';
const denied = () => { throw new AccessError(403, 'No tenés permiso para esta operación.'); };
export async function authorizeResourceRequest(req: Request, db: D1Database, a: Actor) {
    const path = new URL(req.url).pathname;
    if (/%2f|%5c|%00|%25|\\/i.test(path))
        throw new AccessError(400, 'Ruta inválida.');
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (mutating) {
        const origin = req.headers.get('Origin');
        if (origin !== new URL(req.url).origin && !(a.kind === 'native' && !origin))
            denied();
    }
    const access = a.access;
    const assert = (type: ResourceType, id: string, level: Level = mutating ? 'EDIT' : 'VIEW') => access.assert(type, id, level);
    const descendants = (type: ResourceType, id: string) => {
        for (const t of access.resources('TASK')) {
            let n = t;
            const seen = new Set<string>();
            while (n && !seen.has(n.type + ':' + n.id)) {
                seen.add(n.type + ':' + n.id);
                if (n.type === type && n.id === id) {
                    assert('TASK', t.id, 'EDIT');
                    break;
                }
                if (!n.parentId || !n.parentType)
                    break;
                n = access.resources(n.parentType).find(r => r.id === n.parentId)!;
            }
        }
    };
    let body: Record<string, unknown> = {};
    if (mutating && req.headers.get('Content-Type')?.includes('application/json'))
        body = await req.clone().json().catch(() => { throw new AccessError(400, 'JSON inválido.'); }) as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Array.isArray(body))
        throw new AccessError(400, 'JSON inválido.');
    const row = async (sql: string, id: string) => db.prepare(sql).bind(id).first<Record<string, string>>();
    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    if (parts[0] === 'restored-files') {
        const file = await row('SELECT taskId FROM Attachment WHERE url=?', path);
        if (!file)
            throw new AccessError(404, 'Archivo no encontrado.');
        assert('TASK', file.taskId, 'VIEW');
        return;
    }
    if (parts[0] === 'mcp') {
        if (!access.admin)
            denied();
        return;
    }
    if (parts[0] !== 'api') {
        if (parts[0] === 'l' && parts[1]) {
            if (!access.visibleList(parts[1]))
                denied();
            return;
        }
        if (['documents', 'lab-report'].includes(parts[0]) && !access.admin)
            denied();
        if (!['home', 'settings', 'dashboards', 'documents', 'lab-report', '_next'].includes(parts[0]))
            denied();
        return;
    }
    const [, kind, id, action] = parts;
    if (kind === 'restore') {
        if (mutating && !access.admin)
            denied();
        return;
    }
    if (kind === 'health' || kind === 'bootstrap' || kind === 'search') {
        if (mutating)
            denied();
        return;
    }
    if (kind === 'me' || kind === 'notifications' || kind === 'avatar')
        return;
    if (kind === 'stream')
        return;
    if (kind === 'auth') {
        denied();
        return;
    }
    if (kind === 'templates') {
        if (!access.admin)
            denied();
        return;
    }
    if (kind === 'tasks') {
        if (id === 'bulk') {
            if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 200)
                throw new AccessError(400, 'Seleccioná hasta 200 tareas.');
            for (const tid of body.ids as string[]) {
                assert('TASK', tid, 'EDIT');
                if (body.delete)
                    descendants('TASK', tid);
            }
        }
        else if (id) {
            const comment = (action === 'comments' && req.method === 'POST');
            assert('TASK', id, comment ? 'COMMENT' : mutating ? 'EDIT' : 'VIEW');
            if (mutating && (req.method === 'DELETE' || action === 'move'))
                descendants('TASK', id);
            if (action === 'move' || action === 'duplicate') {
                const task = access.resources('TASK').find(t => t.id === id);
                if (task?.listId)
                    assert('LIST', task.listId, 'EDIT');
            }
        }
        else {
            if (req.method !== 'POST')
                denied();
            assert('LIST', String(body.listId), 'EDIT');
            if (body.parentId) {
                assert('TASK', String(body.parentId), 'EDIT');
                const parent = access.resources('TASK').find(t => t.id === body.parentId);
                if (parent?.listId !== body.listId)
                    throw new AccessError(400, 'La subtarea debe pertenecer a la misma lista.');
            }
        }
    }
    else if (kind === 'lists') {
        if (id) {
            if (!mutating) {
                if (!access.visibleList(id))
                    denied();
            }
            else
                assert('LIST', id);
            if (mutating && action !== 'favorite' && action !== 'custom-fields')
                descendants('LIST', id);
            if (action === 'apply-template' && !access.admin)
                denied();
        }
        else
            assert('SPACE', String(body.spaceId), 'EDIT');
    }
    else if (kind === 'spaces') {
        if (!id) {
            if (!access.admin)
                denied();
        }
        else {
            assert('SPACE', id);
            if (req.method === 'DELETE')
                descendants('SPACE', id);
        }
    }
    else if (kind === 'folders') {
        const f = id ? await row('SELECT spaceId FROM Folder WHERE id=?', id) : { spaceId: String(body.spaceId) };
        if (!f)
            throw new AccessError(404, 'Carpeta no encontrada.');
        assert('SPACE', f.spaceId);
        if (req.method === 'DELETE') {
            const lists = await db.prepare('SELECT id FROM List WHERE folderId=?').bind(id).all<{
                id: string;
            }>();
            for (const l of lists.results)
                descendants('LIST', l.id);
        }
    }
    else if (['views', 'statuses'].includes(kind)) {
        const r = await row(`SELECT listId FROM ${kind === 'views' ? 'View' : 'Status'} WHERE id=?`, id);
        if (!r)
            throw new AccessError(404, 'Recurso no encontrado.');
        assert('LIST', r.listId);
        if (mutating && kind === 'statuses')
            descendants('LIST', r.listId);
    }
    else if (kind === 'dependencies') {
        const r = await row('SELECT blockerId,blockedId FROM TaskDependency WHERE id=?', id);
        if (!r)
            throw new AccessError(404, 'Dependencia no encontrada.');
        assert('TASK', r.blockerId);
        assert('TASK', r.blockedId);
    }
    else {
        const sql: Record<string, string> = { comments: 'SELECT taskId FROM Comment WHERE id=?', checklists: 'SELECT taskId FROM Checklist WHERE id=?', 'checklist-items': 'SELECT c.taskId FROM ChecklistItem i JOIN Checklist c ON c.id=i.checklistId WHERE i.id=?', attachments: 'SELECT taskId FROM Attachment WHERE id=?', files: 'SELECT taskId FROM Attachment WHERE id=?', 'time-entries': 'SELECT taskId FROM TimeEntry WHERE id=?' };
        if (!sql[kind])
            denied();
        const r = await row(sql[kind], id);
        if (!r)
            throw new AccessError(404, 'Recurso no encontrado.');
        assert('TASK', r.taskId, kind === 'comments' && mutating ? 'COMMENT' : mutating ? 'EDIT' : 'VIEW');
    }
    if (mutating) {
        if (typeof body.parentId === 'string' && kind === 'tasks' && action === 'comments') {
            const parent = await row('SELECT taskId FROM Comment WHERE id=?', body.parentId);
            if (parent?.taskId !== id)
                throw new AccessError(400, 'El comentario pertenece a otra tarea.');
        }
        if (a.role === 'GUEST')
            denied();
        for (const key of ['listId', 'spaceId', 'otherTaskId'])
            if (typeof body[key] === 'string')
                assert(key === 'listId' ? 'LIST' : key === 'spaceId' ? 'SPACE' : 'TASK', body[key] as string, 'EDIT');
        const targetTasks = id === 'bulk' ? body.ids as string[] : kind === 'tasks' && id ? [id] : [];
        const patch = typeof body.patch === 'object' && body.patch ? body.patch as Record<string, unknown> : body;
        if (typeof patch.statusId === 'string') {
            const status = await row('SELECT listId FROM Status WHERE id=?', patch.statusId);
            if (!status)
                throw new AccessError(400, 'Estado inválido.');
            const targetList = typeof body.listId === 'string' ? body.listId : undefined;
            for (const tid of targetTasks) {
                if (access.resources('TASK').find(t => t.id === tid)?.listId !== status.listId)
                    throw new AccessError(400, 'El estado pertenece a otra lista.');
            }
            if (targetList && targetList !== status.listId)
                throw new AccessError(400, 'El estado pertenece a otra lista.');
        }
        if (typeof body.folderId === 'string') {
            const folder = await row('SELECT spaceId FROM Folder WHERE id=?', body.folderId);
            if (!folder || folder.spaceId !== body.spaceId)
                throw new AccessError(400, 'La carpeta pertenece a otro espacio.');
            assert('SPACE', folder.spaceId, 'EDIT');
        }
        if (kind === 'tasks' && id && action === 'fields' && parts[4]) {
            const field = await row('SELECT listId FROM CustomField WHERE id=?', parts[4]);
            if (!field || field.listId !== access.resources('TASK').find(t => t.id === id)?.listId)
                throw new AccessError(400, 'Campo de otra lista.');
        }
    }
}
