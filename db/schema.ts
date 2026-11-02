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
  listId: text("listId").notNull().references((): AnySQLiteColumn => ListTable.id, {onDelete: "cascade"}),
  name: text("name").notNull(),
  type: text("type").notNull(),
  config: text("config"),
  position: real("position").notNull().default(0)
}, (t) => [index("CustomField_listId_index").on(t.listId)]);

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
