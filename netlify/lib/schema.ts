// Minimal runtime validator for the Functions' request bodies and the
// model's tool output. Deliberately small (the shapes are simple and fixed)
// rather than a schema library dependency. Every check returns the first
// problem found as a short, path-qualified message, or null when valid.
// Unknown object keys are rejected, so a client can't smuggle extra fields
// into prompts, and every string and array has an explicit upper bound.

export type Check = (value: unknown, path: string) => string | null;

type StrOpts = { max: number; min?: number; oneOf?: readonly string[]; pattern?: RegExp };
export function str(opts: StrOpts): Check {
  return (v, path) => {
    if (typeof v !== "string") return `${path} must be a string`;
    if (v.length > opts.max) return `${path} must be at most ${opts.max} characters`;
    if (opts.min !== undefined && v.trim().length < opts.min) return `${path} must not be empty`;
    if (opts.oneOf && !opts.oneOf.includes(v)) return `${path} has an unsupported value`;
    if (opts.pattern && !opts.pattern.test(v)) return `${path} has an unsupported format`;
    return null;
  };
}

export function num(opts: { min: number; max: number; integer?: boolean }): Check {
  return (v, path) => {
    if (typeof v !== "number" || !Number.isFinite(v)) return `${path} must be a number`;
    if (opts.integer && !Number.isInteger(v)) return `${path} must be an integer`;
    if (v < opts.min || v > opts.max) return `${path} must be between ${opts.min} and ${opts.max}`;
    return null;
  };
}

export const bool: Check = (v, path) => (typeof v === "boolean" ? null : `${path} must be true or false`);

export function arr(item: Check, opts: { max: number; min?: number }): Check {
  return (v, path) => {
    if (!Array.isArray(v)) return `${path} must be an array`;
    if (v.length > opts.max) return `${path} must have at most ${opts.max} entries`;
    if (opts.min !== undefined && v.length < opts.min) return `${path} must have at least ${opts.min} entries`;
    for (let i = 0; i < v.length; i++) {
      const err = item(v[i], `${path}[${i}]`);
      if (err) return err;
    }
    return null;
  };
}

// Record with bounded string keys and uniformly-typed values.
export function record(value: Check, opts: { maxKeys: number; keyMax: number }): Check {
  return (v, path) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return `${path} must be an object`;
    const keys = Object.keys(v);
    if (keys.length > opts.maxKeys) return `${path} must have at most ${opts.maxKeys} entries`;
    for (const k of keys) {
      if (k.length > opts.keyMax) return `${path} has an over-long key`;
      const err = value((v as Record<string, unknown>)[k], `${path}.${k}`);
      if (err) return err;
    }
    return null;
  };
}

type Shape = Record<string, { check: Check; optional?: boolean }>;
export function obj(shape: Shape): Check {
  return (v, path) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return `${path} must be an object`;
    const o = v as Record<string, unknown>;
    for (const key of Object.keys(o)) {
      if (!(key in shape)) return `${path}.${key} is not an accepted field`;
    }
    for (const [key, spec] of Object.entries(shape)) {
      if (!(key in o) || o[key] === undefined) {
        if (spec.optional) continue;
        return `${path}.${key} is required`;
      }
      const err = spec.check(o[key], `${path}.${key}`);
      if (err) return err;
    }
    return null;
  };
}

export const req = (check: Check) => ({ check });
export const opt = (check: Check) => ({ check, optional: true });

export function validate(check: Check, value: unknown, root = "body"): string | null {
  return check(value, root);
}
