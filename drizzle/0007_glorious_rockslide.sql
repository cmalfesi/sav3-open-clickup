CREATE TABLE `ExternalIdentity` (
	`issuer` text NOT NULL,
	`subject` text NOT NULL,
	`userId` text NOT NULL,
	PRIMARY KEY(`issuer`, `subject`),
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `AutomationRun` ADD `attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `OAuthLoginState` ADD `userId` text;--> statement-breakpoint
ALTER TABLE `PasswordRecovery` ADD `consumedBy` text;