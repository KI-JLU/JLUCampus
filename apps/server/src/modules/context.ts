import type { Context } from 'hono'

import type { AppEnvironment, ModuleRuntime } from './types.js'
import type { SingletonComponentType } from '@justcampus/shared'

export function getModuleRuntime<T extends SingletonComponentType>(
  context: Context<AppEnvironment>,
  type: T
): ModuleRuntime<T> {
  const runtime = context.get('module')
  if (runtime.type !== type) throw new Error(`Expected ${type} module context`)
  return runtime as ModuleRuntime<T>
}
