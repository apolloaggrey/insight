CREATE TABLE "database_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"type_id" text NOT NULL,
	"settings" text NOT NULL,
	"encrypted_secrets" text,
	"created_by" text,
	"last_sync_at" timestamp,
	"last_sync_ok" boolean,
	"last_sync_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "database_connection" ADD CONSTRAINT "database_connection_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_connection" ADD CONSTRAINT "database_connection_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "database_connection_project_name_idx" ON "database_connection" USING btree ("project_id","name");