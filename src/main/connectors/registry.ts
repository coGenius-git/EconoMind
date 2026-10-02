import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js'

import { LITERATURE_TOOLS } from './descriptors/literature'
import type { ToolDescriptor } from './types'

const ALL_TOOLS: ToolDescriptor[] = [...LITERATURE_TOOLS]

const inputSchemaCompiler = new Ajv2020({
  strict: true,
  allowUnionTypes: true,
  allErrors: false,
  validateFormats: false,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
  ownProperties: true,
  addUsedSchema: false
})

const inputValidators = new Map<ToolDescriptor, ValidateFunction>(
  ALL_TOOLS.map((tool) => [tool, inputSchemaCompiler.compile(tool.input)])
)

const boundedField = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value.slice(0, 128) : undefined

const validationDetail = (error: ErrorObject | undefined): string => {
  if (!error) return 'arguments must match the registered Input schema'
  if (error.keyword === 'required') {
    const field = boundedField(error.params.missingProperty)
    return field ? `field ${JSON.stringify(field)} is required` : 'a required field is missing'
  }
  if (error.keyword === 'additionalProperties') {
    const field = boundedField(error.params.additionalProperty)
    return field
      ? `field ${JSON.stringify(field)} is not allowed`
      : 'an unknown field is not allowed'
  }

  const path = boundedField(error.instancePath.replace(/^\//, '').replaceAll('/', '.'))
  const subject = path ? `field ${JSON.stringify(path)}` : 'arguments'
  return `${subject} ${error.message ?? 'must match the registered Input schema'}`
}

export function validateToolArguments(
  descriptor: ToolDescriptor,
  args: Record<string, unknown>
): void {
  const validate = inputValidators.get(descriptor)
  if (!validate)
    throw new Error(`unregistered tool descriptor: ${descriptor.connector}/${descriptor.id}`)
  if (validate(args)) return

  throw new Error(
    `connector call rejected: invalid_arguments. Invalid tool arguments for ${descriptor.connector}/${descriptor.id}: ${validationDetail(validate.errors?.[0])}. ` +
      `Correct the arguments to match the Input schema in the loaded mcp-${descriptor.connector} Skill, then retry the same method once. ` +
      'Do not retry unchanged or bypass host.mcp.'
  )
}

export const ALL_CONNECTOR_IDS = [...new Set(ALL_TOOLS.map((t) => t.connector))]

export function getConnectorTools(connector: string): ToolDescriptor[] {
  return ALL_TOOLS.filter((t) => t.connector === connector)
}

export function getDescriptor(connector: string, method: string): ToolDescriptor | undefined {
  return ALL_TOOLS.find((t) => t.connector === connector && t.id === method)
}
