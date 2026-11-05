-- Rebuild the field table without disabling foreign keys. Preserve both dependent tables.
CREATE TABLE __field_option_backup AS SELECT * FROM CustomFieldOption;
--> statement-breakpoint
CREATE TABLE __field_value_backup AS SELECT * FROM CustomFieldValue;
--> statement-breakpoint
DROP TABLE CustomFieldOption;
--> statement-breakpoint
DROP TABLE CustomFieldValue;
--> statement-breakpoint
CREATE TABLE `__new_CustomField` (
	`id` text PRIMARY KEY NOT NULL,
	`listId` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`config` text,
	`position` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`listId`) REFERENCES `List`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_CustomField`("id", "listId", "name", "type", "config", "position") SELECT "id", "listId", "name", "type", "config", "position" FROM `CustomField`;--> statement-breakpoint
DROP TABLE `CustomField`;--> statement-breakpoint
ALTER TABLE `__new_CustomField` RENAME TO `CustomField`;--> statement-breakpoint
CREATE INDEX `CustomField_listId_index` ON `CustomField` (`listId`);
--> statement-breakpoint
CREATE TABLE CustomFieldOption (
 id text PRIMARY KEY NOT NULL, customFieldId text NOT NULL REFERENCES CustomField(id) ON DELETE CASCADE,
 label text NOT NULL, color text NOT NULL DEFAULT '#656f7d', position real NOT NULL DEFAULT 0
);
--> statement-breakpoint
INSERT INTO CustomFieldOption SELECT * FROM __field_option_backup;
--> statement-breakpoint
DROP TABLE __field_option_backup;
--> statement-breakpoint
CREATE INDEX CustomFieldOption_customFieldId_index ON CustomFieldOption(customFieldId);
--> statement-breakpoint
CREATE TABLE CustomFieldValue (
 id text PRIMARY KEY NOT NULL, taskId text NOT NULL REFERENCES Task(id) ON DELETE CASCADE,
 customFieldId text NOT NULL REFERENCES CustomField(id) ON DELETE CASCADE, value text NOT NULL
);
--> statement-breakpoint
INSERT INTO CustomFieldValue SELECT * FROM __field_value_backup;
--> statement-breakpoint
DROP TABLE __field_value_backup;
--> statement-breakpoint
CREATE UNIQUE INDEX CustomFieldValue_taskId_customFieldId_unique ON CustomFieldValue(taskId,customFieldId);
--> statement-breakpoint
CREATE INDEX CustomFieldValue_taskId_index ON CustomFieldValue(taskId);
--> statement-breakpoint
CREATE TABLE `CustomFieldLocation` (
	`customFieldId` text NOT NULL,
	`spaceId` text,
	`listId` text,
	FOREIGN KEY (`customFieldId`) REFERENCES `CustomField`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`spaceId`) REFERENCES `Space`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`listId`) REFERENCES `List`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CustomFieldLocation_space` ON `CustomFieldLocation` (`customFieldId`,`spaceId`);--> statement-breakpoint
CREATE UNIQUE INDEX `CustomFieldLocation_list` ON `CustomFieldLocation` (`customFieldId`,`listId`);--> statement-breakpoint
CREATE TABLE `CustomFieldRevision` (
	`customFieldId` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`writeKey` text NOT NULL,
	`createdBy` text,
	`createdAt` integer,
	FOREIGN KEY (`customFieldId`) REFERENCES `CustomField`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

--> statement-breakpoint
CREATE TRIGGER CustomFieldOption_protect_values BEFORE DELETE ON CustomFieldOption
WHEN EXISTS (
 SELECT 1 FROM CustomFieldValue v WHERE v.customFieldId=OLD.customFieldId AND
 (v.value=json_quote(OLD.id) OR EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(v.value) THEN v.value ELSE 'null' END) WHERE value=OLD.id))
)
BEGIN SELECT RAISE(ABORT,'OPTION_IN_USE'); END;
