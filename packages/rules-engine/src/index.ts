/**
 * @freeops/rules-engine package entry point.
 *
 * Config-driven compliance rules engine (PILA/DIAN, LATAM-ready) —
 * app_spec.md, "Config-driven compliance rules engine (PILA/DIAN,
 * LATAM-ready)". No PILA/DIAN formula is ever hardcoded in application
 * code; every rule is versioned config data resolved point-in-time via
 * `resolveActiveRegulatoryConfig`.
 *
 * Later stages (not this one) will import from here:
 *   import { resolveActiveRegulatoryConfig, calculatePila } from "@freeops/rules-engine";
 */
export * from "./config";
export * from "./resolver";
export * from "./pila";
