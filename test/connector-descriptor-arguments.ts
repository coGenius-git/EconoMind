import Ajv2020 from 'ajv/dist/2020.js'
import type { ToolDescriptor } from '../src/main/connectors/types'

// Retired connectors still have isolated descriptor tests. Validate their authored schema without
// registering them in the EconoMind production catalog. Registry rejection is tested separately.
const compiler = new Ajv2020({ strict: true, allowUnionTypes: true, validateFormats: false })
export function validateDescriptorArguments(
  descriptor: ToolDescriptor,
  args: Record<string, unknown>
): void {
  const validate = compiler.compile(descriptor.input)
  if (!validate(args)) throw new Error(compiler.errorsText(validate.errors))
}
