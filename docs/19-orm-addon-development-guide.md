# 19 — ORM Addon Development Guide

**Status:** Approved developer contract  
**Version:** 1.1  
**Updated:** 2026-11-07

## 1. Purpose

This guide defines how RIOTWORKS developers and coding agents create ORM addons. Addon authors declare desired models in TypeScript. The ORM composes shared base metadata and reconciles the database schema programmatically.

**Do not write a schema migration file for every new field or ordinary model edit.**

## 2. Addon package contract

Each addon is a workspace package with:
- unique technical name;
- semantic version;
- manifest;
- public exports;
- model/schema declarations;
- services and hooks;
- optional typed data-upgrade handlers;
- tests and documentation.

Example: packages/orm-addon-project  
Package name: @riotworks/orm-addon-project.

Every persisted business addon depends on base unless a documented framework-only exception applies.

## 3. Manifest example

    export const projectAddon = defineAddon({
      name: "project",
      version: "1.0.0",
      description: "Project and task management domain",
      engine: { orm: "^1.0.0" },
      depends: { base: "^1.0.0" },
      models: [Project, ProjectTask],
      services: [projectService]
    });

Models are the schema declaration. The addon manifest does not need a hand-authored migration list for normal field changes.

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

Intentionally absent:
- id
- active
- createdAt
- updatedAt
- createdBy
- updatedBy
- generic audit fields/methods

These are centrally composed from orm-addon-base by the ORM registry. Addon authors do not redeclare them.

## 5. Automatic model extension

An addon can extend a model owned by a declared dependency:

    export const ProjectIntelligenceExtension = extendModel(
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

The extending addon declares a dependency on the addon that owns the model. Registry composition validates field names, types, ordering, and conflicts.

No import-time side effects or hidden global model mutations.

## 6. Schema reconciliation behavior

When the addon registry changes:
1. ORM composes model metadata, including BaseEntity.
2. Schema reconciler obtains actual schema from the active adapter.
3. Reconciler calculates a deterministic schema diff.
4. Changes are classified.
5. Safe changes are synchronized according to environment policy.
6. Any required data-upgrade handler runs.
7. The resulting schema is verified and its fingerprint recorded.

A repeated synchronization with no new change must be a no-op.

Safe automatic changes:
- New collection/model.
- Add nullable field.
- Add field with explicit safe default if adapter supports it.
- Add compatible index.
- Add optional relation when adapter supports it.
- Non-breaking metadata edits.

Explicit data-upgrade cases:
- Rename a field with a declared mapping.
- Convert data type/precision.
- Backfill before making a field required.
- Split or merge fields.
- Change semantic meaning or relationship ownership.
- Destructive removal.

For a rename, developers should declare metadata such as:

    fields: {
      displayName: fields.string({
        required: true,
        renamedFrom: "name"
      })
    }

The reconciler must verify that this mapping is unambiguous. It must not guess that a removed field and a new field are the same thing.

## 7. Typed data-upgrade handlers

Only when data transformation is necessary, an addon may declare a typed handler:

    export const projectDataUpgrades = [
      defineDataUpgrade({
        id: "project-name-to-display-name",
        from: "1.0.0",
        to: "1.1.0",
        async run(context) {
          // Use the ORM's typed record APIs.
          // Process bounded batches.
          // Be idempotent and report checkpoints.
        }
      })
    ];

Handlers require:
- version boundary;
- precondition and postcondition;
- idempotency;
- bounded batch size;
- checkpoint/resume behavior for large datasets;
- structured progress and errors;
- audit context;
- explicit data-loss risk declaration.

Do not make routine schema additions into data-upgrade handlers. Do not put raw SQL in addon handlers by default. Use ORM record operations and adapter-supported operations.

## 8. BaseEntity and AuditTrail

The ORM composes BaseEntity for every persisted model:
- stable ID.
- active=true by default.
- centrally managed created/updated timestamps.
- trusted actor fields.
- optional version.
- central archive metadata.

On PocketBase, canonical ORM fields may map to native PocketBase system fields (for example id/created/updated) instead of creating duplicate physical columns. Adapter mapping is responsible for provider-specific names.

The active flag is distinct from a domain status. Project state=completed means work is complete; Project active=false means it is archived/deactivated in normal queries.

The base ORM lifecycle automatically emits generic AuditTrail events. Addons must not create duplicate generic audit tables or copy-paste audit hooks. Domain-specific events may exist only when they describe a business event beyond generic record changes.

## 9. PocketBase-specific development flow

- Declare models and fields in the addon package.
- Run schema sync in development.
- The PocketBase adapter maps desired metadata to supported collection operations.
- When collection changes are made through PocketBase's Dashboard or Web API with automigrate enabled, PocketBase generates native pb_migrations files.
- RIOTWORKS can also generate provider-native artifacts from the schema plan.
- Review and commit the generated PB artifacts with the addon/model change.
- Production applies them through the PocketBase migration engine.

Ordinary addon authors do not hand-write PB migration JavaScript or raw SQL for a new field. Do not change PocketBase's internal SQLite tables directly.

## 10. Addon lifecycle and uninstall

- Discover approved workspace addon.
- Validate manifest and version compatibility.
- Resolve dependencies and cycles.
- Compose model registry.
- Preview schema changes.
- Apply safe sync.
- Run explicit data-upgrade handler if required.
- Verify and record addon/schema fingerprint.
- Initialize services.

Uninstall or disable must not silently drop tables, collections, or user data. It deactivates the addon and marks owned resources; physical removal requires an explicit export/backup and destructive plan.

## 11. Adapter capability constraints

Declarative relation metadata does not imply every adapter supports SQL joins, transactions, or all operators.

The ORM must check the adapter capability registry. Unsupported eager expansion, atomic bulk writes, constraints, type changes, and schema operations fail explicitly.

## 12. Required tests for every addon

- Manifest validation.
- Dependency resolution.
- Model registration and extension.
- BaseEntity composition without duplicate declarations.
- Schema diff and deterministic plan.
- Safe sync idempotency.
- Data-upgrade handler pre/postconditions.
- Field validation and relations.
- Permission checks.
- Lifecycle hook order.
- Central audit event generation.
- Adapter compatibility behavior.
- Package exports and typecheck.

## 13. Project addon

May own Project, ProjectTask, ProjectMilestone, ProjectMembership, and ProjectLabel. It owns project-specific fields, constraints, and services—not shared IDs, active flags, timestamps, or generic audit.

## 14. Intelligent addon

May own AIProvider, AIModel, ModelCapability, Agent, AgentRole, AgentRun, AgentTask, ToolDefinition, ToolExecution, PromptTemplate, PromptVersion, KnowledgeSource, EvaluationSuite, EvaluationRun, UsageRecord, CostRecord, and GuardrailPolicy.

It stores references to protected secrets, not provider credentials. Agent/model usage must be attributable to a run/task and support cost visibility.

## 15. Definition of done

An addon is ready only when its manifest, models, services, permissions, schema declarations, optional data-upgrade handlers, tests, documentation, and compatibility behavior are complete. It must reuse BaseEntity, central AuditTrail, and the programmatic schema reconciler.
