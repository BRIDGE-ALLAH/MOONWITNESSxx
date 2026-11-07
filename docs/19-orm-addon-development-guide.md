# 19 — ORM Addon Development Guide

**Status:** Approved developer contract  
**Version:** 1.0  
**Updated:** 2026-11-07

## 1. Purpose

This guide defines how future RIOTWORKS developers and coding agents create ORM addons. The goal is Odoo-like modularity without field duplication, hidden coupling, or unpredictable runtime monkey-patching.

## 2. Addon package contract

Each addon is a workspace package with:
- a unique technical name;
- semantic version;
- manifest;
- public exports;
- model definitions;
- services;
- migrations;
- tests;
- documentation.

Example package: packages/orm-addon-project  
Example package name: @riotworks/orm-addon-project

Every addon declares base as a dependency unless it is explicitly a framework-only/abstract addon with a documented exception.

## 3. Manifest example

    export const projectAddon = defineAddon({
      name: "project",
      version: "1.0.0",
      description: "Project and task management domain",
      engine: {
        orm: "^1.0.0"
      },
      depends: {
        base: "^1.0.0"
      },
      models: [
        Project,
        ProjectTask
      ],
      migrations: projectMigrations,
      services: [
        projectService
      ]
    });

The actual type should validate required fields and dependency ranges.

## 4. Model example

    export const Project = defineModel({
      name: "project.project",
      label: "Project",
      fields: {
        name: fields.string({
          required: true,
          maxLength: 160
        }),
        description: fields.text({
          nullable: true
        }),
        state: fields.selection({
          values: ["draft", "active", "completed", "cancelled"],
          default: "draft"
        }),
        startAt: fields.datetime({
          nullable: true
        })
      },
      indexes: [
        index("project_name_idx", ["name"])
      ]
    });

Notice what is intentionally absent:
- id
- active
- createdAt
- updatedAt
- createdBy
- updatedBy
- audit methods

These are injected/composed from orm-addon-base by the ORM registry. Addon authors do not redeclare them.

## 5. Model extension example

An addon may extend a model from a declared dependency:

    export const ProjectWithIntelligence = extendModel(
      "project.project",
      {
        fields: {
          aiSummary: fields.text({ nullable: true }),
          intelligenceState: fields.selection({
            values: ["not_requested", "queued", "ready", "failed"],
            default: "not_requested"
          })
        }
      }
    );

The addon must declare a dependency on the addon that owns project.project. Registry composition validates field names, types, dependency order, and conflicts.

Do not extend models through import-time side effects or mutation of hidden global objects.

## 6. BaseEntity behavior

The ORM composes BaseEntity for every persisted model:
- stable ID.
- active=true by default.
- centrally managed created/updated timestamps.
- trusted actor fields.
- optional optimistic version.
- central archive metadata.

active is distinct from a domain status field. For example:
- Project state=completed means the work is complete.
- Project active=false means it is archived/deactivated in normal listings.

The default ORM search policy excludes inactive records unless an explicitly authorized query includes them.

## 7. Audit behavior

The base ORM lifecycle automatically emits audit events. Addons must not create their own duplicate audit_log models or copy-paste audit hooks.

A domain addon may add a business-specific event only when it represents a real domain event beyond generic record changes (e.g. project membership invited, agent run approved). Generic create/update/archive audit remains centralized.

All audit payloads must redact secrets and sensitive personal data.

## 8. Lifecycle hooks

Supported conceptual hook phases:
- beforeValidate
- afterValidate
- beforeCreate
- afterCreate
- beforeUpdate
- afterUpdate
- beforeArchive
- afterArchive
- beforeRestore
- afterRestore
- beforeDelete
- afterDelete

Hooks must be deterministic, ordered, typed, and observable. Hook failure behavior must be documented. Hooks must not bypass permission checks or audit generation.

## 9. Relations and adapter constraints

Model relations declaratively, but do not assume every adapter supports every operation.

- belongsTo / many-to-one.
- hasMany / one-to-many.
- many-to-many.

A relation can exist as metadata even if a specific adapter uses manual expansion or does not support eager joins. Query methods must inspect adapter capabilities. Unsupported eager joins, atomic bulk writes, constraints, and migrations fail explicitly.

## 10. Migrations

Each addon owns its migration files and version history.

Migration rules:
- deterministic ordering by addon dependency graph and migration version;
- preflight and backup for destructive changes;
- idempotency where possible;
- no silent schema drift;
- rollback only when explicitly safe and supported;
- preserve migration receipts;
- never run untrusted migration code from an untrusted package.

PocketBase migrations must use PocketBase-supported migration mechanisms. The ORM adapter may orchestrate/check them, but must not mutate internal SQLite tables directly.

## 11. Addon lifecycle

- Discover package from the approved workspace/build registry.
- Validate manifest and compatibility.
- Resolve dependency graph.
- Detect cycles and conflicts.
- Register model metadata.
- Plan and apply migrations.
- Initialize services.
- Mark addon ready.
- Record installed version and checksum/build.
- On upgrade, run explicit upgrade plan.
- On uninstall, preserve or export business data unless a separately approved purge plan exists.

Never dynamically download and execute arbitrary addons.

## 12. Required tests for every addon

- Manifest validation.
- Dependency resolution.
- Model registration.
- BaseEntity injection without duplicate declarations.
- Field validation.
- Relation capability behavior.
- Permission checks.
- Lifecycle hook order.
- Audit event generation.
- Migration plan and failure handling.
- No circular dependency.
- Package exports and typecheck.

## 13. Project addon example

orm-addon-project may own:
- Project.
- ProjectTask.
- ProjectMilestone.
- ProjectMembership.
- ProjectLabel.

It owns project names, task state, dates, membership, and project constraints. It does not own shared IDs, active flags, timestamps, or generic audit.

## 14. Intelligent addon example

orm-addon-intelligent may own:
- AIProvider.
- AIModel.
- ModelCapability.
- Agent.
- AgentRole.
- AgentRun.
- AgentTask.
- ToolDefinition.
- ToolExecution.
- PromptTemplate.
- PromptVersion.
- KnowledgeSource.
- EvaluationSuite.
- EvaluationRun.
- UsageRecord.
- CostRecord.
- GuardrailPolicy.

It stores references to secrets, not provider credentials. Agent and model usage must be attributable to a run/task and support cost visibility.

## 15. Definition of done

An addon is ready only when its manifest, models, migrations, services, permissions, public API, tests, documentation, and upgrade behavior are complete. It must reuse BaseEntity and central AuditTrail.
