CREATE TABLE `Activity` (
	`id` text PRIMARY KEY NOT NULL,
	`taskId` text NOT NULL,
	`userId` text,
	`type` text NOT NULL,
	`data` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `Activity_taskId_index` ON `Activity` (`taskId`);--> statement-breakpoint
CREATE TABLE `Attachment` (
	`id` text PRIMARY KEY NOT NULL,
	`taskId` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`size` integer NOT NULL,
	`mime` text NOT NULL,
	`uploadedById` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Attachment_taskId_index` ON `Attachment` (`taskId`);--> statement-breakpoint
CREATE TABLE `ChecklistItem` (
	`id` text PRIMARY KEY NOT NULL,
	`checklistId` text NOT NULL,
	`name` text NOT NULL,
	`resolved` integer DEFAULT 0 NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`checklistId`) REFERENCES `Checklist`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ChecklistItem_checklistId_index` ON `ChecklistItem` (`checklistId`);--> statement-breakpoint
CREATE TABLE `Checklist` (
	`id` text PRIMARY KEY NOT NULL,
	`taskId` text NOT NULL,
	`name` text DEFAULT 'Checklist' NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Checklist_taskId_index` ON `Checklist` (`taskId`);--> statement-breakpoint
CREATE TABLE `CommentReaction` (
	`id` text PRIMARY KEY NOT NULL,
	`commentId` text NOT NULL,
	`userId` text NOT NULL,
	`emoji` text NOT NULL,
	FOREIGN KEY (`commentId`) REFERENCES `Comment`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CommentReaction_commentId_userId_emoji_unique` ON `CommentReaction` (`commentId`,`userId`,`emoji`);--> statement-breakpoint
CREATE TABLE `Comment` (
	`id` text PRIMARY KEY NOT NULL,
	`taskId` text NOT NULL,
	`userId` text NOT NULL,
	`body` text NOT NULL,
	`parentId` text,
	`resolved` integer DEFAULT 0 NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parentId`) REFERENCES `Comment`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Comment_taskId_index` ON `Comment` (`taskId`);--> statement-breakpoint
CREATE TABLE `CustomFieldOption` (
	`id` text PRIMARY KEY NOT NULL,
	`customFieldId` text NOT NULL,
	`label` text NOT NULL,
	`color` text DEFAULT '#656f7d' NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`customFieldId`) REFERENCES `CustomField`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CustomFieldOption_customFieldId_index` ON `CustomFieldOption` (`customFieldId`);--> statement-breakpoint
CREATE TABLE `CustomField` (
	`id` text PRIMARY KEY NOT NULL,
	`listId` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`config` text,
	`position` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`listId`) REFERENCES `List`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CustomField_listId_index` ON `CustomField` (`listId`);--> statement-breakpoint
CREATE TABLE `CustomFieldValue` (
	`id` text PRIMARY KEY NOT NULL,
	`taskId` text NOT NULL,
	`customFieldId` text NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customFieldId`) REFERENCES `CustomField`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CustomFieldValue_taskId_customFieldId_unique` ON `CustomFieldValue` (`taskId`,`customFieldId`);--> statement-breakpoint
CREATE INDEX `CustomFieldValue_taskId_index` ON `CustomFieldValue` (`taskId`);--> statement-breakpoint
CREATE TABLE `Favorite` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`listId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`listId`) REFERENCES `List`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Favorite_userId_listId_unique` ON `Favorite` (`userId`,`listId`);--> statement-breakpoint
CREATE INDEX `Favorite_userId_index` ON `Favorite` (`userId`);--> statement-breakpoint
CREATE TABLE `Folder` (
	`id` text PRIMARY KEY NOT NULL,
	`spaceId` text NOT NULL,
	`name` text NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`collapsed` integer DEFAULT 0 NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`spaceId`) REFERENCES `Space`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Folder_spaceId_index` ON `Folder` (`spaceId`);--> statement-breakpoint
CREATE TABLE `List` (
	`id` text PRIMARY KEY NOT NULL,
	`spaceId` text NOT NULL,
	`folderId` text,
	`name` text NOT NULL,
	`color` text,
	`icon` text,
	`position` real DEFAULT 0 NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`spaceId`) REFERENCES `Space`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folderId`) REFERENCES `Folder`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `List_spaceId_index` ON `List` (`spaceId`);--> statement-breakpoint
CREATE INDEX `List_folderId_index` ON `List` (`folderId`);--> statement-breakpoint
CREATE TABLE `Notification` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`actorId` text,
	`taskId` text,
	`type` text NOT NULL,
	`body` text NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Notification_userId_index` ON `Notification` (`userId`);--> statement-breakpoint
CREATE TABLE `RestoreState` (
	`id` text PRIMARY KEY NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`ownerKey` text,
	`complete` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Session` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expiresAt` DATETIME NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Session_userId_index` ON `Session` (`userId`);--> statement-breakpoint
CREATE TABLE `Space` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#7b68ee' NOT NULL,
	`icon` text,
	`private` integer DEFAULT 0 NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Space_workspaceId_index` ON `Space` (`workspaceId`);--> statement-breakpoint
CREATE TABLE `Status` (
	`id` text PRIMARY KEY NOT NULL,
	`listId` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#87909e' NOT NULL,
	`type` text DEFAULT 'NOT_STARTED' NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`wipLimit` integer,
	FOREIGN KEY (`listId`) REFERENCES `List`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Status_listId_index` ON `Status` (`listId`);--> statement-breakpoint
CREATE TABLE `Tag` (
	`id` text PRIMARY KEY NOT NULL,
	`spaceId` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#656f7d' NOT NULL,
	FOREIGN KEY (`spaceId`) REFERENCES `Space`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Tag_spaceId_name_unique` ON `Tag` (`spaceId`,`name`);--> statement-breakpoint
CREATE INDEX `Tag_spaceId_index` ON `Tag` (`spaceId`);--> statement-breakpoint
CREATE TABLE `TaskAssignee` (
	`taskId` text NOT NULL,
	`userId` text NOT NULL,
	PRIMARY KEY(`taskId`, `userId`),
	FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `TaskDependency` (
	`id` text PRIMARY KEY NOT NULL,
	`blockerId` text NOT NULL,
	`blockedId` text NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`blockerId`) REFERENCES `Task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blockedId`) REFERENCES `Task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `TaskDependency_blockerId_blockedId_unique` ON `TaskDependency` (`blockerId`,`blockedId`);--> statement-breakpoint
CREATE INDEX `TaskDependency_blockerId_index` ON `TaskDependency` (`blockerId`);--> statement-breakpoint
CREATE INDEX `TaskDependency_blockedId_index` ON `TaskDependency` (`blockedId`);--> statement-breakpoint
CREATE TABLE `Task` (
	`id` text PRIMARY KEY NOT NULL,
	`listId` text NOT NULL,
	`statusId` text NOT NULL,
	`parentId` text,
	`name` text NOT NULL,
	`description` text,
	`priority` text,
	`position` real DEFAULT 0 NOT NULL,
	`startDate` DATETIME,
	`dueDate` DATETIME,
	`timeEstimate` integer,
	`recurrence` text,
	`createdById` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` DATETIME NOT NULL,
	`completedAt` DATETIME,
	`archived` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`listId`) REFERENCES `List`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`statusId`) REFERENCES `Status`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parentId`) REFERENCES `Task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `Task_listId_index` ON `Task` (`listId`);--> statement-breakpoint
CREATE INDEX `Task_statusId_index` ON `Task` (`statusId`);--> statement-breakpoint
CREATE INDEX `Task_parentId_index` ON `Task` (`parentId`);--> statement-breakpoint
CREATE TABLE `TaskTag` (
	`taskId` text NOT NULL,
	`tagId` text NOT NULL,
	PRIMARY KEY(`taskId`, `tagId`),
	FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `TaskTemplate` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`name` text NOT NULL,
	`taskName` text NOT NULL,
	`description` text,
	`priority` text,
	`checklists` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `TaskTemplate_workspaceId_index` ON `TaskTemplate` (`workspaceId`);--> statement-breakpoint
CREATE TABLE `TaskWatcher` (
	`taskId` text NOT NULL,
	`userId` text NOT NULL,
	PRIMARY KEY(`taskId`, `userId`),
	FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `TimeEntry` (
	`id` text PRIMARY KEY NOT NULL,
	`taskId` text NOT NULL,
	`userId` text NOT NULL,
	`duration` integer DEFAULT 0 NOT NULL,
	`description` text,
	`startedAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`endedAt` DATETIME,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `TimeEntry_taskId_index` ON `TimeEntry` (`taskId`);--> statement-breakpoint
CREATE INDEX `TimeEntry_userId_index` ON `TimeEntry` (`userId`);--> statement-breakpoint
CREATE TABLE `User` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`passwordHash` text,
	`color` text DEFAULT '#7b68ee' NOT NULL,
	`avatarUrl` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `User_email_unique` ON `User` (`email`);--> statement-breakpoint
CREATE TABLE `View` (
	`id` text PRIMARY KEY NOT NULL,
	`listId` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`config` text,
	`position` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`listId`) REFERENCES `List`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `View_listId_index` ON `View` (`listId`);--> statement-breakpoint
CREATE TABLE `WorkspaceMember` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`userId` text NOT NULL,
	`role` text DEFAULT 'MEMBER' NOT NULL,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `WorkspaceMember_workspaceId_userId_unique` ON `WorkspaceMember` (`workspaceId`,`userId`);--> statement-breakpoint
CREATE TABLE `Workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#7b68ee' NOT NULL,
	`avatarUrl` text,
	`createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
