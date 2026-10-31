type JsonSchema = Record<string, unknown>;

const JSON_SCHEMA_KEYWORDS = new Set([
  "type",
  "enum",
  "properties",
  "items",
  "required",
  "additionalProperties",
  "anyOf",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function schemaAllowsNull(schema: JsonSchema): boolean {
  if (Array.isArray(schema.type) && schema.type.includes("null")) return true;
  return (
    Array.isArray(schema.anyOf) &&
    schema.anyOf.some((branch) => isRecord(branch) && branch.type === "null")
  );
}

/**
 * Groq strict structured outputs require every declared property to be required,
 * closed objects, and a supported JSON Schema subset. Keep the shape and enums;
 * leave range/length checks to the independent Zod validator below.
 */
export function toGroqStrictJsonSchema(value: unknown): JsonSchema {
  if (!isRecord(value)) throw new Error("INVALID_PROPOSAL_JSON_SCHEMA");

  const schema: JsonSchema = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!JSON_SCHEMA_KEYWORDS.has(key)) continue;

    if (key === "properties" && isRecord(entry)) {
      const priorRequired = new Set(
        Array.isArray(value.required)
          ? value.required.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
      );
      const properties: Record<string, JsonSchema> = {};

      for (const [property, propertySchema] of Object.entries(entry)) {
        const normalized = toGroqStrictJsonSchema(propertySchema);
        properties[property] =
          priorRequired.has(property) || schemaAllowsNull(normalized)
            ? normalized
            : { anyOf: [normalized, { type: "null" }] };
      }

      schema.properties = properties;
      schema.required = Object.keys(properties);
      schema.additionalProperties = false;
    } else if (key === "items" || key === "anyOf") {
      if (key === "items") {
        schema.items = toGroqStrictJsonSchema(entry);
      } else if (Array.isArray(entry)) {
        schema.anyOf = entry.map((branch) => toGroqStrictJsonSchema(branch));
      }
    } else if (key === "required") {
      // Rebuilt from properties above to include nullable optional properties.
      continue;
    } else {
      schema[key] = entry;
    }
  }

  if (schema.type === "object") {
    const properties = isRecord(schema.properties) ? schema.properties : {};
    schema.required = Object.keys(properties);
    schema.additionalProperties = false;
  }

  return schema;
}
