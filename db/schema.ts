import { sqliteTable, text, integer, real, uniqueIndex, index, primaryKey, customType, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

import { sql } from "drizzle-orm";

const datetime = customType<{data: string; driverData: string}>({dataType: () => "DATETIME"});

export const UserTable = sqliteTable("User", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("passwordHash"),
  color: text("color").notNull().default("#7b68ee"),
  avatarUrl: text("avatarUrl"),
  createdAt: datetime("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const FavoriteTable = sqliteTable("Favorite", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().references((): AnySQLiteColumn => UserTable.id, {onDelete: "cascade"}),
  listId: text("listId").notNull().references((): AnySQLiteColumn => ListTable.id, {onDelete: "cascade"})
}, (t) => [uniqueIndex("Favorite_userId_listId_unique").on(t.userId, t.listId), index("Favorite_userId_index").on(t.userId)]);

export const NotificationTable = sqliteTable("Notification", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().references((): AnySQLiteColumn => UserTable.id, {onDelete: "cascade"}),
  actorId: text("actorId").references((): AnySQLiteColumn => UserTable.id, {onDelete: "no action"}),
  taskId: text("taskId").references((): AnySQLiteColumn => TaskTable.id, {onDelete: "cascade"}),
  type: text("type").notNull(),
  body: text("body").notNull(),
  read: integer("read").notNull().default(0),
  createdAt: datetime("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`)
}, (t) => [index("Notification_userId_index").on(t.userId)]);

export const SessionTable = sqliteTable("Session", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().references((): AnySQLiteColumn => UserTable.id, {onDelete: "cascade"}),
  expiresAt: datetime("expiresAt").notNull(),
  createdAt: datetime("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`)
}, (t) => [index("Session_userId_index").on(t.userId)]);

export const WorkspaceTable = sqliteTable("Workspace", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#7b68ee"),
  avatarUrl: text("avatarUrl"),
  createdAt: datetime("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const TaskTemplateTable = sqliteTable("TaskTemplate", {
  id: text("id").primaryKey(),
  workspaceId: text("workspaceId").notNull().references((): AnySQLiteColumn => WorkspaceTable.id, {onDelete: "cascade"}),
  name: text("name").notNull(),
  taskName: text("taskName").notNull(),
  description: text("description"),
  priority: text("priority"),
  checklists: text("checklists"),
  createdAt: datetime("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`)
}, (t) => [index("TaskTemplate_workspaceId_index").on(t.workspaceId)]);

export const WorkspaceMemberTable = sqliteTable("WorkspaceMember", {
  id: text("id").primaryKey(),
  workspaceId: text("workspaceId").notNull().references((): AnySQLiteColumn => WorkspaceTable.id, {onDelete: "cascade"}),
  userId: text("userId").notNull().references((): AnySQLiteColumn => UserTable.id, {onDelete: "cascade"}),
  role: text("role").notNull().default("MEMBER"),
  createdAt: datetime("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`)
}, (t) => [uniqueIndex("WorkspaceMember_workspaceId_userId_unique").on(t.workspaceId, t.userId)]);

export const SpaceTable = sqliteTable("Space", {
  id: text("id").primaryKey(),
  workspaceId: text("workspaceId").notNull().references((): AnySQLiteColumn => WorkspaceTable.id, {onDelete: "cascade"}),
  name: text("name").notNull(),
  color: text("color").notNull().default("#7b68ee"),
  icon: text("icon"),
  private: integer("private").notNull().default(0),
  position: real("position").notNull().default(0),
  createdAt: datetime("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`)
}, (t) => [index("Space_workspaceId_index").on(t.workspaceId)]);

export const FolderTable = sqliteTable("Folder", {
  id: text("id").primaryKey(),
  spaceId: text("spaceId").notNull().references((): AnySQLiteColumn => SpaceTable.id, {onDelete: "cascade"}),
  name: text("name").notNull(),
  position: real("position").notNull().default(0),
  collapsed: integer("collapsed").notNull().default(0),
  createdAt: datetime("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`)
}, (t) => [index("Folder_spaceId_index").on(t.spaceId)]);

export const ListTable = sqliteTable("List", {
  id: text("id").primaryKey(),
  spaceId: text("spaceId").notNull().references((): AnySQLiteColumn => SpaceTable.id, {onDelete: "cascade"}),
  folderId: text("folderId").references((): AnySQLiteColumn => FolderTable.id, {onDelete: "cascade"}),
  name: text("name").notNull(),
  color: text("color"),
  icon: text("icon"),
  position: real("position").notNull().default(0),
  createdAt: datetime("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`)
}, (t) => [index("List_spaceId_index").on(t.spaceId), index("List_folderId_index").on(t.folderId)]);

export const StatusTable = sqliteTable("Status", {
  id: text("id").primaryKey(),
  listId: text("listId").notNull().references((): AnySQLiteColumn => ListTable.id, {onDelete: "cascade"}),
  name: text("name").notNull(),
  color: text("color").notNull().default("#87909e"),
  type: text("type").notNull().default("NOT_STARTED"),
  position: real("position").notNull().default(0),
  wipLimit: integer("wipLimit")
}, (t) => [index("Status_listId_index").on(t.listId)]);

export const TaskTable = sqliteTable("Task", {
  id: text("id").primaryKey(),
  listId: text("listId").notNull().references((): AnySQLiteColumn => ListTable.id, {onDelete: "cascade"}),
  statusId: text("statusId").notNull().references((): AnySQLiteColumn => StatusTable.id, {onDelete: "no action"}),
  parentId: text("parentId").references((): AnySQLiteColumn => TaskTable.id, {onDelete: "cascade"}),
  name: text("name").notNull(),
  description: text("description"),
  priority: text("priority"),
  position: real("position").notNull().default(0),
  startDate: datetime("startDate"),
  dueDate: datetime("dueDate"),
  timeEstimate: integer("timeEstimate"),
  recurrence: text("recurrence"),
  createdById: text("createdById").references((): AnySQLiteColumn => UserTable.id, {onDelete: "no action"}),
  createdAt: datetime("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime("updatedAt").notNull(),
  completedAt: datetime("completedAt"),
  archived: integer("archived").notNull().default(0)
}, (t) => [index("Task_listId_index").on(t.listId), index("Task_statusId_index").on(t.statusId), index("Task_parentId_index").on(t.parentId)]);

export const TaskAssigneeTable = sqliteTable("TaskAssignee", {
  taskId: text("taskId").notNull().references((): AnySQLiteColumn => TaskTable.id, {onDelete: "cascade"}),
  userId: text("userId").notNull().references((): AnySQLiteColumn => UserTable.id, {onDelete: "cascade"})
}, (t) => [primaryKey({columns: [t.taskId, t.userId]})]);

export const TaskWatcherTable = sqliteTable("TaskWatcher", {
  taskId: text("taskId").notNull().references((): AnySQLiteColumn => TaskTable.id, {onDelete: "cascade"}),
  userId: text("userId").notNull().references((): AnySQLiteColumn => UserTable.id, {onDelete: "cascade"})
}, (t) => [primaryKey({columns: [t.taskId, t.userId]})]);

export const TagTable = sqliteTable("Tag", {
  id: text("id").primaryKey(),
  spaceId: text("spaceId").notNull().references((): AnySQLiteColumn => SpaceTable.id, {onDelete: "cascade"}),
  name: text("name").notNull(),
  color: text("color").notNull().default("#656f7d")
}, (t) => [uniqueIndex("Tag_spaceId_name_unique").on(t.spaceId, t.name), index("Tag_spaceId_index").on(t.spaceId)]);

export const TaskTagTable = sqliteTable("TaskTag", {
  taskId: text("taskId").notNull().references((): AnySQLiteColumn => TaskTable.id, {onDelete: "cascade"}),
  tagId: text("tagId").notNull().references((): AnySQLiteColumn => TagTable.id, {onDelete: "cascade"})
}, (t) => [primaryKey({columns: [t.taskId, t.tagId]})]);

export const CustomFieldTable = sqliteTable("CustomField", {
  id: text("id").primaryKey(),
  listId: text("listId").references((): AnySQLiteColumn => ListTable.id, {onDelete: "set null"}),
  name: text("name").notNull(),
  type: text("type").notNull(),
  config: text("config"),
  position: real("position").notNull().default(0)
}, (t) => [index("CustomField_listId_index").on(t.listId)]);

export const CustomFieldLocationTable = sqliteTable("CustomFieldLocation", {
  customFieldId: text("customFieldId").notNull().references((): AnySQLiteColumn => CustomFieldTable.id, {onDelete: "cascade"}),
  spaceId: text("spaceId").references((): AnySQLiteColumn => SpaceTable.id, {onDelete: "cascade"}),
  listId: text("listId").references((): AnySQLiteColumn => ListTable.id, {onDelete: "cascade"}),
}, (t) => [
  uniqueIndex("CustomFieldLocation_space").on(t.customFieldId, t.spaceId),
  uniqueIndex("CustomFieldLocation_list").on(t.customFieldId, t.listId),
]);

export const CustomFieldRevisionTable = sqliteTable("CustomFieldRevision", {
  customFieldId: text("customFieldId").primaryKey().references((): AnySQLiteColumn => CustomFieldTable.id, {onDelete: "cascade"}),
  revision: integer("revision").notNull().default(0),
  writeKey: text("writeKey").notNull(),
  createdBy: text("createdBy").references((): AnySQLiteColumn => UserTable.id, {onDelete: "set null"}),
  createdAt: integer("createdAt"),
});

export const CustomFieldOptionTable = sqliteTable("CustomFieldOption", {
  id: text("id").primaryKey(),
  customFieldId: text("customFieldId").notNull().references((): AnySQLiteColumn => CustomFieldTable.id, {onDelete: "cascade"}),
  label: text("label").notNull(),
  color: text("color").notNull().default("#656f7d"),
  position: real("position").notNull().default(0)
}, (t) => [index("CustomFieldOption_customFieldId_index").on(t.customFieldId)]);

export const CustomFieldValueTable = sqliteTable("CustomFieldValue", {
  id: text("id").primaryKey(),
  taskId: text("taskId").notNull().references((): AnySQLiteColumn => TaskTable.id, {onDelete: "cascade"}),
  customFieldId: text("customFieldId").notNull().references((): AnySQLiteColumn => CustomFieldTable.id, {onDelete: "cascade"}),
  value: text("value").notNull()
}, (t) => [uniqueIndex("CustomFieldValue_taskId_customFieldId_unique").on(t.taskId, t.customFieldId), index("CustomFieldValue_taskId_index").on(t.taskId)]);

export const ChecklistTable = sqliteTable("Checklist", {
  id: text("id").primaryKey(),
  taskId: text("taskId").notNull().references((): AnySQLiteColumn => TaskTable.id, {onDelete: "cascade"}),
  name: text("name").notNull().default("Checklist"),
  position: real("position").notNull().default(0)
}, (t) => [index("Checklist_taskId_index").on(t.taskId)]);

export const ChecklistItemTable = sqliteTable("ChecklistItem", {
  id: text("id").primaryKey(),
  checklistId: text("checklistId").notNull().references((): AnySQLiteColumn => ChecklistTable.id, {onDelete: "cascade"}),
  name: text("name").notNull(),
  resolved: integer("resolved").notNull().default(0),
  position: real("position").notNull().default(0)
}, (t) => [index("ChecklistItem_checklistId_index").on(t.checklistId)]);

export const CommentTable = sqliteTable("Comment", {
  id: text("id").primaryKey(),
  taskId: text("taskId").notNull().references((): AnySQLiteColumn => TaskTable.id, {onDelete: "cascade"}),
  userId: text("userId").notNull().references((): AnySQLiteColumn => UserTable.id, {onDelete: "cascade"}),
  body: text("body").notNull(),
  parentId: text("parentId").references((): AnySQLiteColumn => CommentTable.id, {onDelete: "cascade"}),
  resolved: integer("resolved").notNull().default(0),
  createdAt: datetime("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime("updatedAt").notNull()
}, (t) => [index("Comment_taskId_index").on(t.taskId)]);

export const CommentReactionTable = sqliteTable("CommentReaction", {
  id: text("id").primaryKey(),
  commentId: text("commentId").notNull().references((): AnySQLiteColumn => CommentTable.id, {onDelete: "cascade"}),
  userId: text("userId").notNull().references((): AnySQLiteColumn => UserTable.id, {onDelete: "cascade"}),
  emoji: text("emoji").notNull()
}, (t) => [uniqueIndex("CommentReaction_commentId_userId_emoji_unique").on(t.commentId, t.userId, t.emoji)]);

export const ActivityTable = sqliteTable("Activity", {
  id: text("id").primaryKey(),
  taskId: text("taskId").notNull().references((): AnySQLiteColumn => TaskTable.id, {onDelete: "cascade"}),
  userId: text("userId").references((): AnySQLiteColumn => UserTable.id, {onDelete: "no action"}),
  type: text("type").notNull(),
  data: text("data"),
  createdAt: datetime("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`)
}, (t) => [index("Activity_taskId_index").on(t.taskId)]);

export const ViewTable = sqliteTable("View", {
  id: text("id").primaryKey(),
  listId: text("listId").notNull().references((): AnySQLiteColumn => ListTable.id, {onDelete: "cascade"}),
  name: text("name").notNull(),
  type: text("type").notNull(),
  config: text("config"),
  position: real("position").notNull().default(0)
}, (t) => [index("View_listId_index").on(t.listId)]);

export const AttachmentTable = sqliteTable("Attachment", {
  id: text("id").primaryKey(),
  taskId: text("taskId").notNull().references((): AnySQLiteColumn => TaskTable.id, {onDelete: "cascade"}),
  name: text("name").notNull(),
  url: text("url").notNull(),
  size: integer("size").notNull(),
  mime: text("mime").notNull(),
  uploadedById: text("uploadedById"),
  createdAt: datetime("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`)
}, (t) => [index("Attachment_taskId_index").on(t.taskId)]);

export const TimeEntryTable = sqliteTable("TimeEntry", {
  id: text("id").primaryKey(),
  taskId: text("taskId").notNull().references((): AnySQLiteColumn => TaskTable.id, {onDelete: "cascade"}),
  userId: text("userId").notNull().references((): AnySQLiteColumn => UserTable.id, {onDelete: "cascade"}),
  duration: integer("duration").notNull().default(0),
  description: text("description"),
  startedAt: datetime("startedAt").notNull().default(sql`CURRENT_TIMESTAMP`),
  endedAt: datetime("endedAt"),
  createdAt: datetime("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`)
}, (t) => [index("TimeEntry_taskId_index").on(t.taskId), index("TimeEntry_userId_index").on(t.userId)]);

export const TaskDependencyTable = sqliteTable("TaskDependency", {
  id: text("id").primaryKey(),
  blockerId: text("blockerId").notNull().references((): AnySQLiteColumn => TaskTable.id, {onDelete: "cascade"}),
  blockedId: text("blockedId").notNull().references((): AnySQLiteColumn => TaskTable.id, {onDelete: "cascade"}),
  createdAt: datetime("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`)
}, (t) => [uniqueIndex("TaskDependency_blockerId_blockedId_unique").on(t.blockerId, t.blockedId), index("TaskDependency_blockerId_index").on(t.blockerId), index("TaskDependency_blockedId_index").on(t.blockedId)]);

export const RestoreStateTable = sqliteTable("RestoreState", {id: text("id").primaryKey(), cursor: integer("cursor").notNull().default(0), ownerKey: text("ownerKey"), complete: integer("complete").notNull().default(0)});

// Local accounts are opt-in. Imported identities remain attribution records.
export const AccountAccessTable = sqliteTable("AccountAccess", {
  userId: text("userId").primaryKey().references((): AnySQLiteColumn => UserTable.id, {onDelete: "cascade"}),
  enabled: integer("enabled").notNull().default(0),
  scopeAll: integer("scopeAll").notNull().default(0)
});
export const ResourceGrantTable = sqliteTable("ResourceGrant", {
  userId: text("userId").notNull().references((): AnySQLiteColumn => UserTable.id, {onDelete: "cascade"}),
  resourceType: text("resourceType").notNull(), resourceId: text("resourceId").notNull(), level: text("level").notNull()
}, t => [uniqueIndex("ResourceGrant_user_resource").on(t.userId, t.resourceType, t.resourceId)]);
export const ResourcePolicyTable = sqliteTable("ResourcePolicy", {
  resourceType: text("resourceType").notNull(), resourceId: text("resourceId").notNull(), restricted: integer("restricted").notNull().default(1)
}, t => [uniqueIndex("ResourcePolicy_resource").on(t.resourceType,t.resourceId)]);
export const InvitationTable = sqliteTable("Invitation", {
  id: text("id").primaryKey(), tokenHash: text("tokenHash").notNull().unique(), userId: text("userId").notNull().references((): AnySQLiteColumn => UserTable.id, {onDelete: "cascade"}),
  email: text("email").notNull(), role: text("role").notNull(), scopeAll: integer("scopeAll").notNull().default(0), grants: text("grants").notNull(),
  expiresAt: integer("expiresAt").notNull(), revoked: integer("revoked").notNull().default(0), accepted: text("accepted"), createdAt: integer("createdAt").notNull(), createdBy: text("createdBy").notNull()
});
export const AuthThrottleTable = sqliteTable("AuthThrottle", { key: text("key").primaryKey(), count: integer("count").notNull().default(0), resetAt: integer("resetAt").notNull() });
export const DashboardTable = sqliteTable("Dashboard", { id: text("id").primaryKey(), name: text("name").notNull(), sources: text("sources").notNull().default('[]'), createdBy: text("createdBy").notNull(), createdAt: integer("createdAt").notNull() });
export const AccessAuditTable = sqliteTable("AccessAudit", { id: text("id").primaryKey(), actorId: text("actorId").notNull(), action: text("action").notNull(), targetId: text("targetId").notNull(), createdAt: integer("createdAt").notNull() });

export const IntegrationTokenTable = sqliteTable("IntegrationToken", {
 id: text("id").primaryKey(), userId: text("userId").notNull().references(() => UserTable.id, {onDelete:"cascade"}),
 name: text("name").notNull(), tokenHash: text("tokenHash").notNull().unique(), scope: text("scope").notNull(),
 createdAt: integer("createdAt").notNull(), expiresAt: integer("expiresAt").notNull(), revoked: integer("revoked").notNull().default(0)
});
export const NotificationPreferenceTable = sqliteTable("NotificationPreference", {
 userId: text("userId").primaryKey().references(() => UserTable.id, {onDelete:"cascade"}),
 mentions: integer("mentions").notNull().default(1), assigned: integer("assigned").notNull().default(1), comments: integer("comments").notNull().default(1)
});
export const ChangeEventTable = sqliteTable("ChangeEvent", {
 seq: integer("seq").primaryKey({autoIncrement:true}), taskId: text("taskId"), listId: text("listId").notNull(),
 actorId: text("actorId").notNull(), clientId: text("clientId"), createdAt: integer("createdAt").notNull()
}, t => [index("ChangeEvent_list_seq").on(t.listId,t.seq)]);

export const DashboardDocumentTable=sqliteTable("DashboardDocument",{
 dashboardId:text("dashboardId").primaryKey().references(()=>DashboardTable.id,{onDelete:"cascade"}),
 config:text("config").notNull(),revision:integer("revision").notNull().default(1),writeKey:text("writeKey").notNull(),
 archived:integer("archived").notNull().default(0),updatedAt:integer("updatedAt").notNull()
});
export const DashboardHistoryTable=sqliteTable("DashboardHistory",{
 id:text("id").primaryKey(),dashboardId:text("dashboardId").notNull().references(()=>DashboardTable.id,{onDelete:"cascade"}),
 actorId:text("actorId").notNull(),revision:integer("revision").notNull(),name:text("name").notNull(),config:text("config").notNull(),createdAt:integer("createdAt").notNull()
});

export const UserViewPreferenceTable=sqliteTable("UserViewPreference",{
 userId:text("userId").notNull().references(()=>UserTable.id,{onDelete:"cascade"}),
 viewId:text("viewId").notNull().references(()=>ViewTable.id,{onDelete:"cascade"}),
 state:text("state").notNull().default('{}'),updatedAt:integer("updatedAt").notNull()
},t=>[uniqueIndex("UserViewPreference_user_view").on(t.userId,t.viewId)]);
export const UserListPreferenceTable=sqliteTable("UserListPreference",{
 userId:text("userId").notNull().references(()=>UserTable.id,{onDelete:"cascade"}),
 listId:text("listId").notNull().references(()=>ListTable.id,{onDelete:"cascade"}),
 activeViewId:text("activeViewId").references(()=>ViewTable.id,{onDelete:"set null"}),updatedAt:integer("updatedAt").notNull()
},t=>[uniqueIndex("UserListPreference_user_list").on(t.userId,t.listId)]);

export const TrashEntityTable=sqliteTable('TrashEntity',{
 id:text('id').primaryKey(),kind:text('kind').notNull(),entityId:text('entityId').notNull(),batchId:text('batchId').notNull(),name:text('name').notNull(),listId:text('listId'),previousArchived:integer('previousArchived').notNull().default(0),deletedBy:text('deletedBy').notNull(),deletedAt:integer('deletedAt').notNull()
},t=>[uniqueIndex('TrashEntity_kind_entityId_unique').on(t.kind,t.entityId),index('TrashEntity_batch_index').on(t.batchId)]);
export const OperationSettingTable=sqliteTable('OperationSetting',{key:text('key').primaryKey(),value:text('value').notNull(),updatedAt:integer('updatedAt').notNull(),updatedBy:text('updatedBy').notNull()});
export const ReminderTable=sqliteTable('Reminder',{id:text('id').primaryKey(),taskId:text('taskId').notNull().references(()=>TaskTable.id,{onDelete:'cascade'}),userId:text('userId').notNull().references(()=>UserTable.id,{onDelete:'cascade'}),dueAt:integer('dueAt').notNull(),body:text('body').notNull(),deliveredAt:integer('deliveredAt'),cancelled:integer('cancelled').notNull().default(0)},t=>[index('Reminder_due_index').on(t.dueAt,t.deliveredAt)]);
export const AutomationRuleTable=sqliteTable('AutomationRule',{id:text('id').primaryKey(),listId:text('listId').notNull().references(()=>ListTable.id,{onDelete:'cascade'}),createdBy:text('createdBy').notNull().references(()=>UserTable.id,{onDelete:'cascade'}),name:text('name').notNull(),config:text('config').notNull(),enabled:integer('enabled').notNull().default(0),revision:integer('revision').notNull().default(1),createdAt:integer('createdAt').notNull()});
export const AutomationRunTable=sqliteTable('AutomationRun',{id:text('id').primaryKey(),ruleId:text('ruleId').notNull().references(()=>AutomationRuleTable.id,{onDelete:'cascade'}),taskId:text('taskId').notNull().references(()=>TaskTable.id,{onDelete:'cascade'}),eventKey:text('eventKey').notNull().unique(),status:text('status').notNull(),detail:text('detail'),createdAt:integer('createdAt').notNull(),attempts:integer('attempts').notNull().default(0)},t=>[index('AutomationRun_rule_index').on(t.ruleId,t.createdAt)]);
export const StageTransitionTable=sqliteTable('StageTransition',{id:integer('id').primaryKey({autoIncrement:true}),taskId:text('taskId').notNull().references(()=>TaskTable.id,{onDelete:'cascade'}),listId:text('listId').notNull(),fromId:text('fromId'),toId:text('toId').notNull(),occurredAt:integer('occurredAt').notNull(),baseline:integer('baseline').notNull().default(0),actorId:text('actorId'),source:text('source'),fieldId:text('fieldId').notNull().default('__status__')},t=>[index('StageTransition_task_index').on(t.taskId,t.occurredAt)]);
export const PasswordRecoveryTable=sqliteTable('PasswordRecovery',{tokenHash:text('tokenHash').primaryKey(),userId:text('userId').notNull().references(()=>UserTable.id,{onDelete:'cascade'}),expiresAt:integer('expiresAt').notNull(),usedAt:integer('usedAt'),consumedBy:text('consumedBy')});
export const OAuthLoginStateTable=sqliteTable('OAuthLoginState',{stateHash:text('stateHash').primaryKey(),nonce:text('nonce').notNull(),verifier:text('verifier').notNull(),expiresAt:integer('expiresAt').notNull(),userId:text('userId')});
export const IdempotentRequestTable=sqliteTable('IdempotentRequest',{key:text('key').primaryKey(),userId:text('userId').notNull(),requestHash:text('requestHash').notNull(),status:integer('status'),response:text('response'),expiresAt:integer('expiresAt').notNull()});
export const WebhookEndpointTable=sqliteTable('WebhookEndpoint',{id:text('id').primaryKey(),createdBy:text('createdBy').notNull().references(()=>UserTable.id,{onDelete:'cascade'}),listId:text('listId').notNull().references(()=>ListTable.id,{onDelete:'cascade'}),url:text('url').notNull(),secret:text('secret').notNull(),enabled:integer('enabled').notNull().default(1),createdAt:integer('createdAt').notNull()});
export const WebhookDeliveryTable=sqliteTable('WebhookDelivery',{id:text('id').primaryKey(),endpointId:text('endpointId').notNull().references(()=>WebhookEndpointTable.id,{onDelete:'cascade'}),payload:text('payload').notNull(),attempts:integer('attempts').notNull().default(0),status:text('status').notNull().default('pending'),nextAt:integer('nextAt').notNull(),detail:text('detail'),lockedUntil:integer('lockedUntil').notNull().default(0)},t=>[index('WebhookDelivery_pending_index').on(t.status,t.nextAt)]);

export const ExternalIdentityTable=sqliteTable("ExternalIdentity",{issuer:text("issuer").notNull(),subject:text("subject").notNull(),userId:text("userId").notNull().references(()=>UserTable.id,{onDelete:"cascade"})},t=>[primaryKey({columns:[t.issuer,t.subject]})]);
export const ReportScheduleTable=sqliteTable('ReportSchedule',{id:text('id').primaryKey(),userId:text('userId').notNull().references(()=>UserTable.id,{onDelete:'cascade'}),dashboardId:text('dashboardId').notNull().references(()=>DashboardTable.id,{onDelete:'cascade'}),frequency:text('frequency').notNull(),hour:integer('hour').notNull(),timezone:text('timezone').notNull(),enabled:integer('enabled').notNull().default(1)});
export const ReportDeliveryTable=sqliteTable('ReportDelivery',{id:text('id').primaryKey(),scheduleId:text('scheduleId').notNull().references(()=>ReportScheduleTable.id,{onDelete:'cascade'}),slot:text('slot').notNull(),status:text('status').notNull(),attempts:integer('attempts').notNull().default(0),updatedAt:integer('updatedAt').notNull()},t=>[uniqueIndex('ReportDelivery_schedule_slot').on(t.scheduleId,t.slot)]);
export const TemplateMetadataTable=sqliteTable('TemplateMetadata',{templateId:text('templateId').primaryKey().references(()=>TaskTemplateTable.id,{onDelete:'cascade'}),config:text('config').notNull()});
export const HierarchyTemplateTable=sqliteTable('HierarchyTemplate',{id:text('id').primaryKey(),workspaceId:text('workspaceId').notNull().references(()=>WorkspaceTable.id,{onDelete:'cascade'}),name:text('name').notNull(),kind:text('kind').notNull(),config:text('config').notNull(),createdBy:text('createdBy').notNull(),createdAt:integer('createdAt').notNull()});
