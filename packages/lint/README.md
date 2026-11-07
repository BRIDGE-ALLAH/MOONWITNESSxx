# Shared lint configuration

This package is reserved for the future shared ESLint flat configuration.

It intentionally exposes no `lint` script yet. The repository currently enforces formatting and repository integrity through the root Prettier/audit commands. Do not add a placeholder command such as `echo lint-skip`, `|| true`, or an ESLint command that has no configuration or source coverage.

When shared source lint is introduced, add a real flat config, pin and declare its parser/plugin dependencies, export the config, add tests/fixtures, and only then wire package-level lint scripts and CI into the task graph.
