-- Make valid invitations issued before 0.12.8 assignable without activating them.
-- Existing members and access records are deliberately preserved.
INSERT OR IGNORE INTO WorkspaceMember(id,workspaceId,userId,role)
SELECT 'pending:'||i.id,'90132980889',i.userId,i.role FROM Invitation i
WHERE i.accepted IS NULL AND i.revoked=0 AND i.expiresAt>unixepoch()*1000
 AND i.role IN ('ADMIN','MEMBER','GUEST')
 AND EXISTS(SELECT 1 FROM Workspace WHERE id='90132980889')
 AND NOT EXISTS(SELECT 1 FROM AccountAccess a WHERE a.userId=i.userId AND a.enabled=1)
 AND NOT EXISTS(SELECT 1 FROM Invitation newer WHERE newer.userId=i.userId AND newer.accepted IS NULL AND newer.revoked=0 AND (newer.createdAt>i.createdAt OR (newer.createdAt=i.createdAt AND newer.id>i.id)));
--> statement-breakpoint
INSERT OR IGNORE INTO AccountAccess(userId,enabled,scopeAll)
SELECT i.userId,0,i.scopeAll FROM Invitation i JOIN WorkspaceMember m ON m.id='pending:'||i.id
WHERE i.accepted IS NULL AND i.revoked=0 AND i.expiresAt>unixepoch()*1000;
--> statement-breakpoint
INSERT OR IGNORE INTO ResourceGrant(userId,resourceType,resourceId,level)
SELECT i.userId,json_extract(g.value,'$.resourceType'),json_extract(g.value,'$.resourceId'),json_extract(g.value,'$.level')
FROM Invitation i JOIN WorkspaceMember m ON m.id='pending:'||i.id, json_each(CASE WHEN json_valid(i.grants) THEN i.grants ELSE '[]' END) g
WHERE i.accepted IS NULL AND i.revoked=0 AND i.expiresAt>unixepoch()*1000
 AND NOT EXISTS(SELECT 1 FROM AccountAccess a WHERE a.userId=i.userId AND a.enabled=1)
 AND json_extract(g.value,'$.resourceType') IN ('SPACE','LIST','TASK','DASHBOARD')
 AND json_extract(g.value,'$.level') IN ('NONE','VIEW','COMMENT','EDIT')
 AND length(json_extract(g.value,'$.resourceId'))>0;
