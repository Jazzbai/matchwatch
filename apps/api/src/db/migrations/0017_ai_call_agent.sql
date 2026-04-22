-- AI Call Agent Qualification fields on venues

CREATE TYPE "ai_call_agent_qualification_status" AS ENUM (
    'NOT_STARTED', 'IN_REVIEW', 'QUALIFIED', 'NEEDS_REVIEW', 'NOT_QUALIFIED'
);

CREATE TYPE "ai_call_agent_reservation_mode" AS ENUM (
    'NONE', 'ANSWER_ONLY', 'COLLECT_REQUEST', 'FULL_INTAKE', 'TRANSFER_TO_STAFF'
);

CREATE TYPE "ai_call_agent_go_live_readiness" AS ENUM (
    'READY_NOW', 'READY_IN_7_DAYS', 'READY_IN_14_DAYS', 'NOT_READY'
);

ALTER TABLE "venues"
    ADD COLUMN "ai_call_agent_qualification_status" "ai_call_agent_qualification_status" NOT NULL DEFAULT 'NOT_STARTED',
    ADD COLUMN "ai_call_agent_qualified_for"         text[]                               NOT NULL DEFAULT '{}',
    ADD COLUMN "ai_call_agent_reservation_mode"      "ai_call_agent_reservation_mode"    NOT NULL DEFAULT 'NONE',
    ADD COLUMN "ai_call_agent_escalation_contact_name"  varchar(150),
    ADD COLUMN "ai_call_agent_escalation_contact_phone" varchar(30),
    ADD COLUMN "ai_call_agent_escalation_contact_email" varchar(255),
    ADD COLUMN "ai_call_agent_languages"             text[]                               NOT NULL DEFAULT '{}',
    ADD COLUMN "ai_call_agent_go_live_readiness"     "ai_call_agent_go_live_readiness"   NOT NULL DEFAULT 'NOT_READY',
    ADD COLUMN "ai_call_agent_notes"                 text,
    ADD COLUMN "ai_call_agent_questionnaire_link"    varchar(500),
    ADD COLUMN "ai_call_agent_qualified_at"          timestamp,
    ADD COLUMN "ai_call_agent_qualified_by_user_id"  uuid REFERENCES "users"("id");
